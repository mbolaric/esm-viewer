import Archive from '@lucide/svelte/icons/archive';
import Bed from '@lucide/svelte/icons/bed';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import ChevronUp from '@lucide/svelte/icons/chevron-up';
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import CircleGauge from '@lucide/svelte/icons/circle-gauge';
import CircleHelp from '@lucide/svelte/icons/circle-help';
import CircleX from '@lucide/svelte/icons/circle-x';
import Columns3 from '@lucide/svelte/icons/columns-3';
import Copy from '@lucide/svelte/icons/copy';
import CreditCard from '@lucide/svelte/icons/credit-card';
import Diff from '@lucide/svelte/icons/diff';
import Download from '@lucide/svelte/icons/download';
import ExternalLink from '@lucide/svelte/icons/external-link';
import Eye from '@lucide/svelte/icons/eye';
import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
import FileText from '@lucide/svelte/icons/file-text';
import FolderOpen from '@lucide/svelte/icons/folder-open';
import Funnel from '@lucide/svelte/icons/funnel';
import Hammer from '@lucide/svelte/icons/hammer';
import Hourglass from '@lucide/svelte/icons/hourglass';
import Layers from '@lucide/svelte/icons/layers';
import LoaderCircle from '@lucide/svelte/icons/loader-circle';
import MapPin from '@lucide/svelte/icons/map-pin';
import Menu from '@lucide/svelte/icons/menu';
import Minus from '@lucide/svelte/icons/minus';
import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
import Pin from '@lucide/svelte/icons/pin';
import Plus from '@lucide/svelte/icons/plus';
import Printer from '@lucide/svelte/icons/printer';
import Search from '@lucide/svelte/icons/search';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import Truck from '@lucide/svelte/icons/truck';
import Upload from '@lucide/svelte/icons/upload';
import Users from '@lucide/svelte/icons/users';
import X from '@lucide/svelte/icons/x';

export type IconName =
    | 'archive'
    | 'bed'
    | 'chevronDown'
    | 'chevronLeft'
    | 'chevronRight'
    | 'chevronUp'
    | 'circleAlert'
    | 'circleCheck'
    | 'circleGauge'
    | 'circleHelp'
    | 'circleX'
    | 'columns'
    | 'copy'
    | 'creditCard'
    | 'diff'
    | 'download'
    | 'externalLink'
    | 'eye'
    | 'fileSpreadsheet'
    | 'fileText'
    | 'filter'
    | 'folderOpen'
    | 'hammer'
    | 'hourglass'
    | 'layers'
    | 'loaderCircle'
    | 'mapPin'
    | 'menu'
    | 'minus'
    | 'octagonAlert'
    | 'pin'
    | 'plus'
    | 'printer'
    | 'search'
    | 'triangleAlert'
    | 'truck'
    | 'upload'
    | 'users'
    | 'x';

const iconRegistry = {
    archive: Archive,
    bed: Bed,
    chevronDown: ChevronDown,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    chevronUp: ChevronUp,
    circleAlert: CircleAlert,
    circleCheck: CircleCheck,
    circleGauge: CircleGauge,
    circleHelp: CircleHelp,
    circleX: CircleX,
    columns: Columns3,
    copy: Copy,
    creditCard: CreditCard,
    diff: Diff,
    download: Download,
    externalLink: ExternalLink,
    eye: Eye,
    fileSpreadsheet: FileSpreadsheet,
    fileText: FileText,
    filter: Funnel,
    folderOpen: FolderOpen,
    hammer: Hammer,
    hourglass: Hourglass,
    layers: Layers,
    loaderCircle: LoaderCircle,
    mapPin: MapPin,
    menu: Menu,
    minus: Minus,
    octagonAlert: OctagonAlert,
    pin: Pin,
    plus: Plus,
    printer: Printer,
    search: Search,
    triangleAlert: TriangleAlert,
    truck: Truck,
    upload: Upload,
    users: Users,
    x: X,
} satisfies Readonly<Record<IconName, typeof CircleCheck>>;

export function getIconComponent(name: IconName): typeof CircleCheck {
    return iconRegistry[name];
}
