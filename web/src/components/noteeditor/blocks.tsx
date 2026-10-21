import type { TFunction } from 'i18next'
import {
  CalendarDays,
  FileText,
  Image,
  Images,
  Kanban,
  Map,
  MapPin,
  Music,
  Navigation,
  Paperclip,
  PenTool,
  Sheet,
  Star,
  Store,
  Table,
  Tag,
  Video,
  Youtube,
} from 'lucide-react'
import {
  BlockText,
  bulletList,
  codeBlock,
  divider,
  heading1,
  heading2,
  heading3,
  numberedList,
  paragraph,
  quote,
  todoList,
  type BlockComponentProps,
  type BlockSpec,
} from '@notomate/editor'
import AttachmentComponent from '@/components/editor/extensions/attachment/AttachmentComponent'
import AudioNodeComponent from '@/components/editor/extensions/audionode/AudioNodeComponent'
import CalendarNodeComponent from '@/components/editor/extensions/calendarnode/CalendarNodeComponent'
import CarouselComponent from '@/components/editor/extensions/carouselnode/CarouselComponent'
import GoogleDirectionsNodeComponent from '@/components/editor/extensions/googlemaps/GoogleDirectionsNodeComponent'
import GoogleMapNodeComponent from '@/components/editor/extensions/googlemaps/GoogleMapNodeComponent'
import GooglePlacesNodeComponent from '@/components/editor/extensions/googlemaps/GooglePlacesNodeComponent'
import ImageComponent from '@/components/editor/extensions/imagenode/ImageComponent'
import InstagramEmbedComponent from '@/components/editor/extensions/instagramembed/InstagramEmbedComponent'
import LocationNodeComponent from '@/components/editor/extensions/locationnode/LocationNodeComponent'
import RatingNodeComponent from '@/components/editor/extensions/ratingnode/RatingNodeComponent'
import SubPageComponent from '@/components/editor/extensions/subpagenode/SubPageComponent'
import TagsNodeComponent from '@/components/editor/extensions/tagsnode/TagsNodeComponent'
import ThreadsEmbedComponent from '@/components/editor/extensions/threadsembed/ThreadsEmbedComponent'
import TiktokEmbedComponent from '@/components/editor/extensions/tiktokembed/TiktokEmbedComponent'
import VideoNodeComponent from '@/components/editor/extensions/videonode/VideoNodeComponent'
import ViewComponent from '@/components/editor/extensions/viewnode/ViewComponent'
import YoutubeEmbedComponent from '@/components/editor/extensions/youtubeembed/YoutubeEmbedComponent'
import { nodeSpec } from './nodeView'
import { NEW_TABLE_ROWS, rowsFromTable, TableComponent } from './TableBlock'
import { PENDING_IMAGE_TAG } from './plugins'
import { InstagramIcon, ThreadsIcon, TiktokIcon } from './icons'

/** Block types of the note editor: the editor's text blocks plus the notomate nodes. */

function heading(level: 4 | 5 | 6, label: string): BlockSpec {
  const type = `h${level}`
  return {
    type,
    component: ({ block }: BlockComponentProps) => (
      <div className={`text ${type}`}>
        <BlockText block={block} />
      </div>
    ),
    menu: { label, icon: `H${level}`, keywords: `heading${level} h${level}` },
    placeholder: label,
    inputRules: [{ pattern: new RegExp(`^${'#'.repeat(level)}\\s$`) }],
    pasteRules: [{ pattern: new RegExp(`^${'#'.repeat(level)}\\s+`) }],
    parseHtml: { tags: [`H${level}`] },
    toMarkdown: (_b, text) => `${'#'.repeat(level)} ${text}`,
    toHtml: (b) => `<${type}>${b.html}</${type}>`,
  }
}

/**
 * A copy of a spec with some fields changed. Built-in specs read their label and
 * placeholder through getters (so they follow the editor's messages); a plain object
 * spread would freeze them at their English defaults.
 */
const extend = (spec: BlockSpec, patch: Partial<BlockSpec>): BlockSpec =>
  Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(spec),
    ...Object.getOwnPropertyDescriptors(patch),
  }) as BlockSpec

/** Paragraphs and headings cannot nest in stored notes (TipTap), so do not offer it. */
const flat = (spec: BlockSpec): BlockSpec => extend(spec, { nestable: false })

const icon = (Icon: typeof Image) => <Icon size={16} />

/** Only web and site-relative image URLs from pasted content. */
const safeSrc = (src: string | null) => (src && /^(https?:|\/)/i.test(src) ? src : null)

export interface NoteBlockOptions {
  /** Whether the workspace has Google Maps set up; read each time the menu opens. */
  googleMapsEnabled: () => boolean
}

export function noteBlocks(t: TFunction, { googleMapsEnabled }: NoteBlockOptions): BlockSpec[] {
  const group = (name: string) => t(`editor.slashCategories.${name}`)
  const media = group('media')
  const embed = group('embed')
  const advanced = group('advanced')
  const views = group('views')
  const maps = group('googleMaps')
  const noMaps = () => !googleMapsEnabled()

  const view = (viewType: string, label: string, Icon: typeof Image, keywords: string) => ({
    label,
    icon: icon(Icon),
    keywords,
    group: views,
    props: { viewType },
  })

  return [
    flat(paragraph),
    flat(heading1),
    flat(heading2),
    flat(heading3),
    flat(heading(4, t('editor.Heading 4'))),
    flat(heading(5, t('editor.Heading 5'))),
    flat(heading(6, t('editor.Heading 6'))),
    bulletList,
    numberedList,
    todoList,
    quote,
    codeBlock,
    divider,
    nodeSpec('table', TableComponent, {
      defaults: { rows: NEW_TABLE_ROWS },
      parseHtml: { tags: ['TABLE'], props: (el) => ({ rows: rowsFromTable(el) }) },
      menu: { label: t('editor.table.name'), icon: icon(Table), keywords: 'table grid', group: group('block') },
    }),

    // Media
    nodeSpec('image', ImageComponent, {
      defaults: { src: null, name: null, width: null, height: null, uploadId: null },
      parseHtml: {
        tags: [PENDING_IMAGE_TAG.toUpperCase(), 'IMG'],
        props: (el) =>
          el.tagName === 'IMG'
            ? { src: safeSrc(el.getAttribute('src')) ?? undefined, name: el.getAttribute('alt') || null }
            : { name: el.getAttribute('data-name'), uploadId: el.getAttribute('data-upload-id') },
      },
      menu: { label: t('editor.Image'), icon: icon(Image), keywords: 'image photo picture img', group: media },
    }),
    nodeSpec('video', VideoNodeComponent, {
      defaults: { src: null, name: null },
      menu: { label: t('editor.Video'), icon: icon(Video), keywords: 'video upload media mp4', group: media },
    }),
    nodeSpec('audio', AudioNodeComponent, {
      defaults: { src: null, name: null },
      menu: { label: t('editor.Audio'), icon: icon(Music), keywords: 'audio music sound mp3 upload', group: media },
    }),
    nodeSpec('attachment', AttachmentComponent, {
      defaults: { src: null, name: null },
      menu: { label: t('editor.Attachment'), icon: icon(Paperclip), keywords: 'file attachment upload', group: media },
    }),
    nodeSpec('carouselNode', CarouselComponent, {
      defaults: { items: [] },
      menu: { label: t('editor.Carousel'), icon: icon(Images), keywords: 'carousel gallery slideshow images media', group: media },
    }),

    // Embeds
    nodeSpec('youtubeEmbed', YoutubeEmbedComponent, {
      defaults: { url: null },
      menu: { label: t('editor.YoutubeEmbed'), icon: icon(Youtube), keywords: 'youtube video embed', group: embed },
    }),
    nodeSpec('threadsEmbed', ThreadsEmbedComponent, {
      defaults: { url: null },
      menu: { label: t('editor.ThreadsEmbed'), icon: <ThreadsIcon />, keywords: 'threads meta social embed', group: embed },
    }),
    nodeSpec('instagramEmbed', InstagramEmbedComponent, {
      defaults: { url: null },
      menu: { label: t('editor.InstagramEmbed'), icon: <InstagramIcon />, keywords: 'instagram ig reel social embed', group: embed },
    }),
    nodeSpec('tiktokEmbed', TiktokEmbedComponent, {
      defaults: { url: null },
      menu: { label: t('editor.TiktokEmbed'), icon: <TiktokIcon />, keywords: 'tiktok short video social embed', group: embed },
    }),

    // Advanced
    nodeSpec('subPage', SubPageComponent, {
      defaults: { noteId: null, title: '' },
      menu: { label: t('editor.SubPage'), icon: icon(FileText), keywords: 'page sub child nested note', group: advanced },
    }),
    nodeSpec('calendarNode', CalendarNodeComponent, {
      defaults: { date: null, title: '', description: '' },
      menu: { label: t('editor.CalendarNode'), icon: icon(CalendarDays), keywords: 'calendar date event schedule', group: advanced },
    }),
    nodeSpec('locationNode', LocationNodeComponent, {
      defaults: { lat: null, lng: null, name: '', address: '', zoom: 15 },
      menu: { label: t('editor.LocationNode'), icon: icon(MapPin), keywords: 'location map place address gps', group: advanced },
    }),
    nodeSpec('tagsNode', TagsNodeComponent, {
      defaults: { tags: [] },
      menu: { label: t('editor.TagsNode'), icon: icon(Tag), keywords: 'tag tags label category', group: advanced },
    }),
    nodeSpec('ratingNode', RatingNodeComponent, {
      defaults: { rating: 0, maxRating: 5, label: '' },
      menu: { label: t('editor.RatingNode'), icon: icon(Star), keywords: 'rating star score review', group: advanced },
    }),

    // Views
    nodeSpec('viewNode', ViewComponent, {
      defaults: { viewId: null, viewType: 'map', name: '' },
      menu: [
        view('map', t('editor.MapView'), Map, 'map location geography view'),
        view('calendar', t('editor.CalendarView'), CalendarDays, 'calendar schedule event view'),
        view('kanban', t('editor.KanbanView'), Kanban, 'kanban board task view'),
        view('whiteboard', t('editor.WhiteboardView'), PenTool, 'whiteboard draw canvas view'),
        view('spreadsheet', t('editor.SpreadsheetView'), Sheet, 'spreadsheet table sheet excel view'),
      ],
    }),

    // Google Maps (only when the workspace has an API key)
    nodeSpec('googleMapNode', GoogleMapNodeComponent, {
      defaults: { title: '', center: null, zoom: 13, markers: [], route: null },
      menu: { label: t('editor.GoogleMapNode'), icon: icon(Map), keywords: 'google map maps place marker location', group: maps, hidden: noMaps },
    }),
    nodeSpec('googlePlacesNode', GooglePlacesNodeComponent, {
      defaults: { query: '', places: [], fetchedAt: null },
      menu: { label: t('editor.GooglePlacesNode'), icon: icon(Store), keywords: 'google places place review photo restaurant shop', group: maps, hidden: noMaps },
    }),
    nodeSpec('googleDirectionsNode', GoogleDirectionsNodeComponent, {
      defaults: { waypoints: [], travelMode: 'DRIVE', optimize: false, result: null, alternatives: null },
      menu: { label: t('editor.GoogleDirectionsNode'), icon: icon(Navigation), keywords: 'google directions route navigation trip', group: maps, hidden: noMaps },
    }),
  ]
}
