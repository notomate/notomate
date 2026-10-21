import { useRef, useState, type PointerEvent } from 'react';
import type { Block } from '../../model/types';
import { selectBlocks } from '../../model/store';
import { setProps } from '../../ops';
import { msg } from '../../messages';

const MIN_WIDTH = 20;

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Placeholder({ id }: { id: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  return (
    <div className="image-empty no-marquee">
      <button type="button" className="image-upload" onClick={() => fileRef.current?.click()}>
        <span aria-hidden="true">🖼</span> {msg().uploadImage}
      </button>
      <form
        className="image-link"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^https?:\/\//.test(url.trim())) setProps([id], { src: url.trim(), width: 100 });
        }}
      >
        <input
          type="url"
          inputMode="url"
          placeholder={msg().imageLinkPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label={msg().imageLink}
        />
        <button type="submit">{msg().embed}</button>
      </form>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setProps([id], { src: await readFile(f), width: 100 });
        }}
      />
    </div>
  );
}

export function ImageBlock({ block }: { block: Block }) {
  const { id, props } = block;
  const frameRef = useRef<HTMLDivElement>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  if (!props.src) return <Placeholder id={id} />;
  const width = liveWidth ?? props.width ?? 100;

  const startResize = (e: PointerEvent<HTMLDivElement>, side: -1 | 1) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const column = frameRef.current?.parentElement?.getBoundingClientRect().width ?? 1;
    const startX = e.clientX;
    const startW = width;
    let w = startW;
    const move = (ev: globalThis.PointerEvent) => {
      // Image is centred, so each side moves by half of the width change.
      const delta = ((ev.clientX - startX) * side * 2 * 100) / column;
      w = Math.round(Math.min(100, Math.max(MIN_WIDTH, startW + delta)));
      setLiveWidth(w);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      setLiveWidth(null);
      if (w !== startW) setProps([id], { width: w });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  return (
    <div className="image-block">
      <div
        ref={frameRef}
        className="image-frame"
        style={{ width: `${width}%` }}
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur?.();
          selectBlocks([id]);
        }}
      >
        <img src={props.src} alt="" draggable={false} />
        <div className="resize-handle left no-marquee" onPointerDown={(e) => startResize(e, -1)} aria-hidden="true" />
        <div className="resize-handle right no-marquee" onPointerDown={(e) => startResize(e, 1)} aria-hidden="true" />
      </div>
    </div>
  );
}
