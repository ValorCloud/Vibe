import type { CSSProperties, ComponentType, HTMLAttributes } from 'react';
import {
  AddRegular,
  AlertRegular,
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  ArrowRedoRegular,
  ArrowShuffleRegular,
  ArrowUndoRegular,
  ArrowUploadRegular,
  BookOpenRegular,
  BotRegular,
  CheckmarkCircleRegular,
  CheckmarkRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  ClipboardPasteRegular,
  ClockRegular,
  CodeRegular,
  CompassNorthwestRegular,
  CopyRegular,
  DataBarVerticalRegular,
  DeleteRegular,
  DesktopRegular,
  DeviceEqRegular,
  DismissCircleRegular,
  DismissRegular,
  DocumentAddRegular,
  DocumentTextRegular,
  FlashRegular,
  FolderOpenRegular,
  FoodAppleRegular,
  GlobeRegular,
  GuitarRegular,
  HardDriveRegular,
  HeadphonesRegular,
  HeartRegular,
  HistoryRegular,
  InfoRegular,
  KeyboardRegular as FluentKeyboardRegular,
  LayoutColumnTwoRegular,
  LayoutRowTwoRegular,
  LibraryRegular,
  LightbulbRegular,
  LinkRegular,
  MusicNote2Regular,
  NumberSymbolRegular,
  OpenRegular,
  PanelRightRegular,
  PauseRegular,
  PeopleRegular,
  PersonRegular,
  PersonVoiceRegular,
  PlayRegular,
  PulseRegular,
  RadioButtonRegular,
  ReOrderDotsVerticalRegular,
  RulerRegular,
  SaveRegular,
  ScanTextRegular,
  SearchRegular,
  SettingsRegular,
  ShoppingBagRegular,
  Speaker2Regular,
  SpeakerOffRegular,
  SparkleRegular,
  SpinnerIosRegular,
  TargetRegular,
  TextAlignJustifyRegular,
  TextAlignLeftRegular,
  TextBulletListSquareRegular,
  TextFontRegular,
  TimerRegular,
  TranslateRegular,
  VideoRegular,
  WandRegular,
  WarningRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  type FluentIconsProps,
} from '@fluentui/react-icons';

type LucideIconProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  color?: string;
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
};

type FluentIconComponent = ComponentType<FluentIconsProps>;

const createIcon = (Icon: FluentIconComponent, displayName: string) => {
  const WrappedIcon = ({
    size,
    color,
    style,
    strokeWidth: _strokeWidth,
    absoluteStrokeWidth: _absoluteStrokeWidth,
    ...props
  }: LucideIconProps) => {
    const mergedStyle: CSSProperties = {
      color,
      fontSize: size,
      width: size,
      height: size,
      ...style,
    };

    return (
      <Icon
        primaryFill="currentColor"
        {...props as FluentIconsProps}
        style={mergedStyle}
      />
    );
  };

  WrappedIcon.displayName = displayName;
  return WrappedIcon;
};

export const X = createIcon(DismissRegular, 'X');
export const Plus = createIcon(AddRegular, 'Plus');
export const Check = createIcon(CheckmarkRegular, 'Check');
export const Loader2 = createIcon(SpinnerIosRegular, 'Loader2');
export const Wand2 = createIcon(WandRegular, 'Wand2');
export const ChevronUp = createIcon(ChevronUpRegular, 'ChevronUp');
export const ChevronDown = createIcon(ChevronDownRegular, 'ChevronDown');
export const GripVertical = createIcon(ReOrderDotsVerticalRegular, 'GripVertical');
export const Trash2 = createIcon(DeleteRegular, 'Trash2');
export const Languages = createIcon(TranslateRegular, 'Languages');
export const Activity = createIcon(PulseRegular, 'Activity');
export const Guitar = createIcon(GuitarRegular, 'Guitar');
export const Drum = createIcon(DeviceEqRegular, 'Drum');
export const ListMusic = createIcon(TextBulletListSquareRegular, 'ListMusic');
export const Play = createIcon(PlayRegular, 'Play');
export const Pause = createIcon(PauseRegular, 'Pause');
export const Music = createIcon(MusicNote2Regular, 'Music');
export const Sparkles = createIcon(SparkleRegular, 'Sparkles');
export const Compass = createIcon(CompassNorthwestRegular, 'Compass');
export const Copy = createIcon(CopyRegular, 'Copy');
export const Search = createIcon(SearchRegular, 'Search');
export const Globe = createIcon(GlobeRegular, 'Globe');
export const ExternalLink = createIcon(OpenRegular, 'ExternalLink');
export const RefreshCw = createIcon(ArrowClockwiseRegular, 'RefreshCw');
export const AlertCircle = createIcon(AlertRegular, 'AlertCircle');
export const Clock = createIcon(ClockRegular, 'Clock');
export const Save = createIcon(SaveRegular, 'Save');
export const BookOpen = createIcon(BookOpenRegular, 'BookOpen');
export const Library = createIcon(LibraryRegular, 'Library');
export const FolderOpen = createIcon(FolderOpenRegular, 'FolderOpen');
export const HardDrive = createIcon(HardDriveRegular, 'HardDrive');
export const Headphones = createIcon(HeadphonesRegular, 'Headphones');
export const AlertTriangle = createIcon(WarningRegular, 'AlertTriangle');
export const Apple = createIcon(FoodAppleRegular, 'Apple');
export const Github = createIcon(CodeRegular, 'Github');
export const Youtube = createIcon(VideoRegular, 'Youtube');
export const Linkedin = createIcon(PeopleRegular, 'Linkedin');
export const Radio = createIcon(RadioButtonRegular, 'Radio');
export const ShoppingBag = createIcon(ShoppingBagRegular, 'ShoppingBag');
export const Info = createIcon(InfoRegular, 'Info');
export const KeyboardRegular = createIcon(FluentKeyboardRegular, 'KeyboardRegular');
export const Ruler = createIcon(RulerRegular, 'Ruler');
export const Bot = createIcon(BotRegular, 'Bot');
export const User = createIcon(PersonRegular, 'User');
export const PersonVoice = createIcon(PersonVoiceRegular, 'PersonVoice');
export const Shuffle = createIcon(ArrowShuffleRegular, 'Shuffle');
export const Lightbulb = createIcon(LightbulbRegular, 'Lightbulb');
export const Hash = createIcon(NumberSymbolRegular, 'Hash');
export const BarChart2 = createIcon(DataBarVerticalRegular, 'BarChart2');
export const ScanText = createIcon(ScanTextRegular, 'ScanText');
export const Timer = createIcon(TimerRegular, 'Timer');
export const CheckCircle2 = createIcon(CheckmarkCircleRegular, 'CheckCircle2');
export const XCircle = createIcon(DismissCircleRegular, 'XCircle');
export const Settings = createIcon(SettingsRegular, 'Settings');
export const Menu = createIcon(TextAlignJustifyRegular, 'Menu');
export const Download = createIcon(ArrowDownloadRegular, 'Download');
export const FileCode2 = createIcon(CodeRegular, 'FileCode2');
export const FileText = createIcon(DocumentTextRegular, 'FileText');
export const History = createIcon(HistoryRegular, 'History');
export const Layout = createIcon(LayoutColumnTwoRegular, 'Layout');
export const LayoutRows = createIcon(LayoutRowTwoRegular, 'LayoutRows');
export const Undo2 = createIcon(ArrowUndoRegular, 'Undo2');
export const Redo2 = createIcon(ArrowRedoRegular, 'Redo2');
export const Upload = createIcon(ArrowUploadRegular, 'Upload');
export const ClipboardPaste = createIcon(ClipboardPasteRegular, 'ClipboardPaste');
export const Monitor = createIcon(DesktopRegular, 'Monitor');
export const Sun = createIcon(WeatherSunnyRegular, 'Sun');
export const Moon = createIcon(WeatherMoonRegular, 'Moon');
export const Volume2 = createIcon(Speaker2Regular, 'Volume2');
export const VolumeX = createIcon(SpeakerOffRegular, 'VolumeX');
export const Type = createIcon(TextFontRegular, 'Type');
export const FileCode = createIcon(CodeRegular, 'FileCode');
export const WandSparkles = createIcon(SparkleRegular, 'WandSparkles');
export const PanelRight = createIcon(PanelRightRegular, 'PanelRight');
export const FilePlus = createIcon(DocumentAddRegular, 'FilePlus');
export const Heart = createIcon(HeartRegular, 'Heart');
export const Link2 = createIcon(LinkRegular, 'Link2');
export const AlignLeft = createIcon(TextAlignLeftRegular, 'AlignLeft');
export const Zap = createIcon(FlashRegular, 'Zap');
export const Target = createIcon(TargetRegular, 'Target');
