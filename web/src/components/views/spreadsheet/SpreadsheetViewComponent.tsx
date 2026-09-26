import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { setAutoFreeze } from 'immer';
import { useTranslation } from 'react-i18next';
import { SpreadsheetSheetData, SpreadsheetOp } from '../../../types/view';
import { useSpreadsheetCollab } from '../../../hooks/use-spreadsheet-collab';

// Disable immer's auto-freezing to allow fortune-sheet to mutate internal state
setAutoFreeze(false);

// Use any for fortune-sheet internal types since they're not fully exported
type Sheet = any;
type Op = any;

// Deep clone helper to ensure fortune-sheet gets mutable data
const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Convert sheets from 'data' format (2D array) to 'celldata' format (sparse array)
const convertDataToCelldata = (sheets: any[]): any[] => {
    return sheets.map(sheet => {
        if (sheet.celldata && sheet.celldata.length > 0) {
            return sheet;
        }
        if (sheet.data && Array.isArray(sheet.data)) {
            const celldata: any[] = [];
            for (let r = 0; r < sheet.data.length; r++) {
                const row = sheet.data[r];
                if (row && Array.isArray(row)) {
                    for (let c = 0; c < row.length; c++) {
                        const cell = row[c];
                        if (cell !== null && cell !== undefined && Object.keys(cell).length > 0) {
                            celldata.push({ r, c, v: cell });
                        }
                    }
                }
            }
            const { data, ...sheetWithoutData } = sheet;
            return { ...sheetWithoutData, celldata };
        }
        return sheet;
    });
};

interface SpreadsheetViewComponentProps {
    view?: {
        id: string;
        data: string;
    };
    isPublic?: boolean;
    readOnly?: boolean;
    workspaceId?: string;
    viewId?: string;
    initialSheets?: SpreadsheetSheetData[];
    disableWebSocket?: boolean;
}

const SpreadsheetViewComponent = ({
    view,
    isPublic = false,
    readOnly = false,
    workspaceId,
    viewId,
    initialSheets,
    disableWebSocket = false
}: SpreadsheetViewComponentProps) => {
    const isReadOnly = isPublic || readOnly
    const { t } = useTranslation();
    const workbookRef = useRef<WorkbookInstance | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse initial sheets from view.data
    const parsedInitialSheets = React.useMemo(() => {
        if (initialSheets && initialSheets.length > 0) {
            return initialSheets;
        }
        if (view?.data) {
            try {
                const parsed = JSON.parse(view.data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed as SpreadsheetSheetData[];
                }
            } catch (e) {
                console.warn('[SpreadsheetView] Failed to parse view.data:', e);
            }
        }
        return [{
            id: 'sheet1',
            name: 'Sheet1',
            order: 0,
            row: 100,
            column: 26,
            celldata: []
        }] as SpreadsheetSheetData[];
    }, [view?.data, initialSheets]);

    // WebSocket connection
    const {
        sendOps,
        sendOpsWithDeletedSheets,
        syncSheets,
        sheets: remoteSheets,
        pendingOps,
        clearPendingOps,
        getLatestSheets,
        isInitialized: wsInitialized
    } = useSpreadsheetCollab({
        viewId: viewId || '',
        workspaceId: workspaceId || '',
        enabled: !disableWebSocket && !!viewId && (isPublic || !!workspaceId),
        isPublic: isPublic,
    });

    // Workbook data and version - only changes on initial sync (not on every cell edit)
    const [workbookData, setWorkbookData] = useState<Sheet[]>(() =>
        deepClone(parsedInitialSheets) as unknown as Sheet[]
    );
    const [dataVersion, setDataVersion] = useState(0);
    const localSheetsRef = useRef<Sheet[]>(workbookData);

    const [isReady, setIsReady] = useState(false);
    const [dataSourceReady, setDataSourceReady] = useState(disableWebSocket);

    // Flag to prevent sending ops back when applying remote ops
    const isApplyingRemoteOpsRef = useRef(false);

    // Handle onChange from fortune-sheet - track current state and sync to Y.Map
    const handleSheetsChange = useCallback((data: Sheet[]) => {
        localSheetsRef.current = data;
        // Sync latest state to Y.Map for persistence (skip when applying remote ops)
        if (!isApplyingRemoteOpsRef.current && !isReadOnly) {
            syncSheets(data as unknown as SpreadsheetSheetData[]);
        }
    }, [isReadOnly, syncSheets]);

    // Monitor container size
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const { width, height } = container.getBoundingClientRect();
            if (width > 0 && height > 0) {
                setIsReady(true);
            }
        };

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);
        setTimeout(updateSize, 100);

        return () => resizeObserver.disconnect();
    }, []);

    // One-time: load initial state from server when WS syncs
    useEffect(() => {
        if (!wsInitialized || dataSourceReady) return;

        setDataSourceReady(true);

        if (remoteSheets && remoteSheets.length > 0) {
            // Server has data - re-mount workbook once with server state
            const converted = convertDataToCelldata(remoteSheets as unknown as Sheet[]);
            const cloned = deepClone(converted);
            localSheetsRef.current = cloned;
            setWorkbookData(cloned);
            setDataVersion(v => v + 1);
        }
    }, [wsInitialized, remoteSheets, dataSourceReady]);

    // Reset on disconnect so reconnect triggers a fresh sync
    useEffect(() => {
        if (!wsInitialized && dataSourceReady && !disableWebSocket) {
            setDataSourceReady(false);
        }
    }, [wsInitialized, dataSourceReady, disableWebSocket]);

    // Structural op types that require a full workbook re-mount
    // (fortune-sheet's internal immer freezes state, causing "Cannot delete property" errors)
    const STRUCTURAL_OPS = new Set(['addSheet', 'deleteSheet', 'copySheet']);

    // Apply remote ops to fortune-sheet
    useEffect(() => {
        if (pendingOps.length === 0 || !workbookRef.current) return;

        const hasStructuralOp = pendingOps.some(op => STRUCTURAL_OPS.has(op.op));

        if (hasStructuralOp) {
            // Structural ops (addSheet, etc.) cause frozen-object errors in applyOp.
            // Re-mount the workbook with the latest full state from Y.Map instead.
            const latestSheets = getLatestSheets();
            if (latestSheets) {
                const converted = convertDataToCelldata(latestSheets as unknown as Sheet[]);
                const cloned = deepClone(converted);
                localSheetsRef.current = cloned;
                setWorkbookData(cloned);
                setDataVersion(v => v + 1);
            }
        } else {
            // Cell-level ops can be applied in-place without re-mount
            isApplyingRemoteOpsRef.current = true;
            pendingOps.forEach(op => {
                try {
                    workbookRef.current?.applyOp([deepClone(op) as unknown as Op]);
                } catch (e) {
                    console.error('[SpreadsheetView] Failed to apply remote op:', e);
                }
            });
            isApplyingRemoteOpsRef.current = false;
        }

        clearPendingOps();
    }, [pendingOps, clearPendingOps, getLatestSheets]);

    // Handle local operations - send ops to other clients via Y.Array
    const handleOp = useCallback((ops: Op[]) => {
        if (isApplyingRemoteOpsRef.current) return;
        if (!isReadOnly && ops.length > 0) {
            // For deleteSheet ops, atomically delete from Y.Map AND broadcast via Y.Array
            // in one Y.js transaction. This prevents a race condition where remote clients
            // receive the deleteSheet op before Y.Map is updated (causing them to re-mount
            // with stale data that still includes the deleted sheet, then write it back).
            const deletedSheetIds = (ops as any[])
                .filter(op => op.op === 'deleteSheet' && op.id)
                .map((op: any) => op.id as string);

            if (deletedSheetIds.length > 0) {
                sendOpsWithDeletedSheets(ops as unknown as SpreadsheetOp[], deletedSheetIds);
            } else {
                sendOps(ops as unknown as SpreadsheetOp[]);
            }
        }
    }, [isReadOnly, sendOps, sendOpsWithDeletedSheets]);

    const canShowWorkbook = isReady && dataSourceReady;

    return (
        <div ref={containerRef} className="relative w-full h-full bg-white dark:bg-neutral-900">
            {/* Loading state */}
            {!canShowWorkbook && (
                <div className="absolute inset-0 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-neutral-300 border-t-primary rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">
                            {t('spreadsheet.loading') || 'Loading spreadsheet...'}
                        </span>
                    </div>
                </div>
            )}

            {/* FortuneSheet Workbook */}
            {canShowWorkbook && (
                <div style={{ width: '100%', height: '100%' }}>
                    <Workbook
                        key={`workbook-${dataVersion}`}
                        ref={workbookRef}
                        data={workbookData}
                        onChange={handleSheetsChange}
                        onOp={handleOp}
                        showToolbar={!isReadOnly}
                        showFormulaBar={!isReadOnly}
                        showSheetTabs={true}
                        row={100}
                        column={26}
                        allowEdit={!isReadOnly}
                    />
                </div>
            )}
        </div>
    );
};

export default SpreadsheetViewComponent;
