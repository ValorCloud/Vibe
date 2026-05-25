export interface Translations {
  /** Generic shared strings */
  common?: {
    loading: string;
    /** Aria-label for the application splash screen */
    appLoading?: string;
    /** Label shown under the splash spinner during initialization */
    initializing?: string;
  };

  /** Labels for inline error fallbacks rendered by panel ErrorBoundaries.
   *  Use `{label}` placeholder for the panel name in `panelUnavailable`. */
  errorBoundary?: {
    panelUnavailable: string;
    panelGeneric: string;
    closePanel: string;
  };

  /** Labels for the right-side panel switcher (Structure / Suggestions / Analysis). */
  panels?: {
    structure: string;
    suggestions: string;
    analysis: string;
    /** Aria template used for the segmented switcher buttons. Use `{name}`. */
    switchTo: string;
  };

  app: {
    name: string;
    tagline: string;
  };

  /** Locale metadata – only populated for AI-generated draft locales */
  _meta?: {
    /** Whether this locale pack was bootstrapped by AI (pending human review) */
    isAiGenerated: boolean;
    generatedAt: string; // ISO date string
  };

  statusBar: {
    ready: string;
    generating: string;
    analyzing: string;
    suggesting: string;
    sections: string;
    sections_one: string;
    sections_other: string;
    words: string;
    words_one: string;
    words_other: string;
    theme: string;
    audioFeedback: string;
    language: string;
    settings: string;
    settingsTooltip?: string;
    /** Tooltip shown on the saved-session indicator dot */
    sessionSavedTooltip?: string;
    /** Inline badge text next to the saved-session dot */
    sessionSavedBadge?: string;
    /** Inline badge text while the session is being persisted */
    saving?: string;
    /** Inline badge text when the latest changes are not yet saved */
    unsaved?: string;
    /** Inline badge text when the most recent save attempt failed */
    saveError?: string;
    /** Aria-label template for the theme toggle when current theme is dark */
    themeSwitchToLight?: string;
    /** Aria-label template for the theme toggle when current theme is light */
    themeSwitchToDark?: string;
  };

  ribbon: {
    lyrics: string;
    musical: string;
    similarity: string;
    /** Label for the menu entry that opens the import dialog (e.g. "Load / Import") */
    load_import: string;
    /** Label for the menu entry that opens the export dialog (e.g. "Save / Export") */
    save_export: string;
    versions: string;
    undo: string;
    redo: string;
    reset: string;
    aiUnavailable: string;
    /** Tooltip shown on the burger menu trigger */
    menu?: string;
    /** Aria-label for the burger menu trigger */
    menuAria?: string;
    /** Label for the "Send to LYRIA" button in the ribbon */
    send_to_lyria?: string;
    /** Label for the "Copy Lyrics" button in the ribbon */
    copy_lyrics?: string;
    /** Label for the "Copy Musical Prompt" button in the ribbon */
    copy_musical_prompt?: string;
    /** Label for the Player tab */
    player?: string;
  };

  mobileNav: {
    navigation: string;
    settings: string;
    lyrics: string;
    music: string;
    structure: string;
    /** Short label on the centre CTA when it opens the composer panel */
    compose?: string;
    /** Aria-label for the centre CTA when in compose mode */
    composeAria?: string;
    /** Short label on the centre CTA when it triggers a regenerate */
    generateShort?: string;
  };

  /** Labels for the burger-menu panel section headers and menu items */
  menu?: {
    create: string;
    workspace: string;
    tools: string;
    app: string;
    newLyricsGeneration: string;
    newSong: string;
    about: string;
    sponsor: string;
  };

  leftPanel: {
    title: string;
    songTitle: string;
    songTitlePlaceholder: string;
    songTopic: string;
    songTopicPlaceholder: string;
    songMood: string;
    songMoodPlaceholder: string;
    songMoodPresets: string;
    rhymeScheme: string;
    targetSyllables: string;
    quantize: string;
    collapse: string;
    /** Top-right badge that labels the panel as the new-generation form */
    newGenerationBadge?: string;
    /** Section header for the song-info group inside the form */
    songInfoSection?: string;
    /** Label of the "Suggest random" button */
    suggest?: string;
    /** Tooltip of the "Suggest random" button */
    suggestTooltip?: string;
    /** Aria-label for the close button of the form panel */
    closePanel?: string;
  };

  structure: {
    title: string;
    addSection: string;
    normalize: string;
    collapse: string;
  };

  editor: {
    emptyState: {
      title: string;
      description: string;
      loadSession: string;
      pasteLyrics: string;
      generateSong: string;
    };
    markupMode: {
      title: string;
      description: string;
      hint: string;
      placeholder: string;
    };
    textMode: {
      title: string;
      description: string;
      hint: string;
      placeholder: string;
    };
    phoneticMode: {
      title: string;
      description: string;
      hint: string;
      placeholder: string;
      loading?: string;
      languageLabel?: string;
      error?: string;
    };
    sectionTooltip: {
      lines: string;
      words: string;
      syllablesTarget: string;
      rhymeScheme: string;
    };
    analyze: string;
    regenerate: string;
    adaptation: string;
    adaptGlobal: string;
    regenerateGlobal: string;
    regenerateLyrics: string;
    adaptSection: string;
    editorMode: string;
    markupModeLabel: string;
    phoneticModeLabel: string;
    textModeLabel: string;
    regenerateSection: string;
    quantize: string;
    lyricLine: string;
    rhymeSyllable: string;
    rhyme: string;
    syllables: string;
    syllableCount?: string;
    /** Tooltip on the syllable count button to invite inline editing */
    editSyllableCount?: string;
    /** Label in the quantize-offer popover asking the user to confirm quantize */
    quantizeOffer?: string;
    /** Confirm button label in the quantize-offer popover */
    yes?: string;
    /** Reject button label in the quantize-offer popover */
    no?: string;
    /** Column header for the rhyme schema badge */
    schemaHeader?: string;
    concept: string;
    lines: string;
    chars: string;
    adapt: string;
    moodPlaceholder: string;
    regenerateWarning: string;
    /** Button label to add a lyric line to a section */
    addLine?: string;
    /** Button label to add a musical/modulation/effect marker */
    addMusicalEffect?: string;
    moveSectionUp?: string;
    moveSectionDown?: string;
    dragToReorder?: string;
    anchoredSection?: string;
    dragToReorderLine?: string;
    humanLine?: string;
    aiLine?: string;
    moveLineUp?: string;
    moveLineDown?: string;
    deleteLine?: string;
    linePlaceholder?: string;
    addLineAfter?: string;
    /** Tooltip for the per-line language adaptation button */
    adaptLine?: string;
    /** Screen-reader-only label shown while the adaptation button is busy */
    adaptingLabel?: string;
    /** Screen-reader-only label shown while the language-detection button is busy */
    detectingLanguageLabel?: string;
    /** Screen-reader-only label shown while the analyze button is busy */
    analyzingLabel?: string;
    /** Screen-reader-only label shown while the similarity button is busy */
    checkingSimilarityLabel?: string;
    /** Section header label for the lyrics-editors group in the insights bar */
    lyricsEditors?: string;
    /** Section header label for the lyrics-insights group in the insights bar */
    lyricsInsights?: string;
    /** Short label on the detect-language button when no language has been detected yet */
    detect?: string;
    /** Button label to apply the language adaptation */
    adaptApply?: string;
    /** Tooltip for the per-line quantize button */
    quantize_line?: string;
    quantize_line_unsupported?: string;
    quantize_line_done?: string;
    /** Tooltip on APPLY button when no selector has changed */
    applyNoChanges?: string;
    /** Tooltip on APPLY button when language adapt is pending but no lyrics exist */
    applyNoLyrics?: string;
    /** Tooltip on APPLY button when changes are pending */
    applyPending?: string;
  };

  suggestions?: {
    title: string;
    crafting: string;
    clickToApply: string;
    moreOptions: string;
    empty: string;
    spellCheckTitle?: string;
    spellChecking?: string;
    applyCorrection?: string;
    dismiss?: string;
    synonymsTitle?: string;
    synonymsLoading?: string;
  };

  musical: {
    title: string;
    description: string;
    genre: string;
    genrePlaceholder: string;
    tempo: string;
    instrumentation: string;
    instrumentationPlaceholder: string;
    rhythm: string;
    rhythmPlaceholder: string;
    narrative: string;
    narrativePlaceholder: string;
    analyzeLyrics: string;
    analyzeLyricsShort: string;
    analyzing: string;
    autoSuggestLabel: string;
    generatePrompt: string;
    promptLabel: string;
    promptPlaceholder: string;
    promptStructureLabel?: string;
    promptStructureHint?: string;
    optimizedFor: string;
    copyPrompt: string;
    copied: string;
    contextInfo: string;
    metronome: string;
    metronomeStart: string;
    metronomeStop: string;
    instruments?: string;
    instrumentsPlaceholder?: string;
    rhythmPresets?: string;
    vibeBoard?: string;
    vibeBoardDescription?: string;
    subStyle?: string;
  };

  /** Strings for the Lyria 3 preview panel */
  lyria?: {
    /** Section header: read-only musical params block */
    musicalParamsLabel: string;
    /** Shown when no musical params are set */
    noParams: string;
    /** Field label: vocal style input */
    vocalStyle: string;
    /** Placeholder for vocal style input */
    vocalStylePlaceholder: string;
    /** Field label: negative prompt input */
    negativePrompt: string;
    /** Placeholder for negative prompt input */
    negativePromptPlaceholder: string;
    /** Field label: injected lyrics textarea (read-only) */
    injectedLyrics: string;
    /** Button label while generation is in progress */
    generating: string;
    /** Button label when idle */
    generatePreview: string;
    /** KPI footer: success count. Use `{n}` placeholder. */
    successCount: string;
    /** KPI footer: error count. Use `{n}` placeholder. */
    errorCount: string;
    /** KPI footer: last error label. Use `{msg}` placeholder. */
    lastError: string;
    /** Button label to escalate preview to full song */
    escalate: string;
    /** Tooltip on the Alt+A shortcut badge */
    shortcutTooltip: string;
    /** Tooltip on the info icon in the panel header */
    infoTooltip: string;
    /** Aria-label for the Play button */
    play: string;
    /** Aria-label for the Pause button */
    pause: string;
    /** Helper text under the Avoid (negative prompt) input */
    negativePromptHint?: string;
    /** Short label shown when generate is disabled because lyrics are empty */
    lyricsRequired?: string;
    /** Tooltip explaining why generate is disabled when lyrics are empty */
    lyricsRequiredHint?: string;
    /** Title of the MessageBar shown when generation fails */
    errorTitle?: string;
    /** Friendly description for 401/403 (auth) errors */
    errorAuth?: string;
    /** Actionable hint for 401/403 (auth) errors */
    errorAuthHint?: string;
    /** Friendly description for 429 (rate limit) errors */
    errorRateLimit?: string;
    /** Actionable hint for 429 (rate limit) errors */
    errorRateLimitHint?: string;
    /** Friendly description for timeout errors */
    errorTimeout?: string;
    /** Actionable hint for timeout errors */
    errorTimeoutHint?: string;
    /** Friendly description for 5xx (server) errors */
    errorServer?: string;
    /** Actionable hint for 5xx (server) errors */
    errorServerHint?: string;
    /** Friendly description for network/offline errors */
    errorNetwork?: string;
    /** Actionable hint for network/offline errors */
    errorNetworkHint?: string;
  };

  analysis: {
    title: string;
    deepAnalysis: string;
    theme: string;
    emotionalArc: string;
    strengths: string;
    improvements: string;
    musicalSuggestions: string;
    summary: string;
    apply: string;
    revert: string;
    close: string;
    noData: string;
    showMusicalSuggestions?: string;
    hideMusicalSuggestions?: string;
    musicalSuggestionsMovedHint?: string;
  };

  similarity: {
    title: string;
    subtitle: string;
    empty: string;
    noCandidates: string;
    score: string;
    sharedWords: string;
    sharedLines: string;
    matchedSections: string;
    sharedKeywords: string;
    thresholdHint: string;
    webTitle?: string;
    webSubtitle?: string;
    webIdle?: string;
    webRunning?: string;
    webNoMatches?: string;
    webRefresh?: string;
    nGramScoring?: string;
    libraryTitle?: string;
  };

  saveToLibrary: {
    title: string;
    save: string;
    saving: string;
    saved: string;
    saveDescription: string;
    browseDescription: string;
    yourLibrary: string;
    empty: string;
    load: string;
    loadDescription: string;
    close: string;
    storageTitle?: string;
    storageLibraryData?: string;
    storageUsed?: string;
    storageQuota?: string;
    storageSaturation?: string;
    storageScopeLocal?: string;
    libraryItems?: string;
    purge?: string;
    purgeWarning?: string;
    confirmPurge?: string;
    cancel?: string;
  };

  paste: {
    title: string;
    description: string;
    placeholder: string;
    cancel: string;
    analyze: string;
    analyzing: string;
  };

  importDialog: {
    title: string;
    emptyDescription: string;
    replaceDescription: string;
    warning: string;
    supportedFiles: string;
    cancel: string;
    chooseFile: string;
  };

  exportDialog: {
    title: string;
    description: string;
    formatLabel: string;
    cancel: string;
    save: string;
    formats: {
      txt: string;
      markup: string;
      odt: string;
      docx: string;
      /** LRC synchronized lyrics format label */
      lrc?: string;
      /** PDF print format label */
      pdf?: string;
    };
    /** Share link section */
    share?: {
      label?: string;
      description?: string;
      copyLink?: string;
      copied?: string;
    };
  };

  keyboardShortcuts: {
    title: string;
    description: string;
    keysColumn: string;
    actionColumn: string;
    close: string;
    categories: {
      edit: string;
      navigation: string;
      file: string;
      ai: string;
    };
    shortcuts: {
      undo: string;
      redo: string;
      dismissReset: string;
      dismissNavigation: string;
      dismissFileDialogs: string;
      dismissAiDialogs: string;
      openSearch: string;
      goToMusical: string;
      lyriaGenerate: string;
    };
  };

  searchReplace: {
    title: string;
    searchPlaceholder: string;
    replacePlaceholder: string;
    matchCount: string;
    matchCountNone: string;
    previous: string;
    next: string;
    replace: string;
    replaceAll: string;
    caseSensitive: string;
    close: string;
    replacedCount: string;
  };

  about: {
    description: string;
    engine: string;
    engineLabel: string;
    modelLabel: string;
    apiKeyLabel: string;
    license: string;
    licenseLabel: string;
    close: string;
    github: string;
    docs: string;
    splashAutoClose?: string;
  };

  aiAssistant?: {
    title: string;
    onboarding: string;
    placeholder: string;
    send: string;
    close: string;
    thinking: string;
    error: string;
  };

  settings: {
    title: string;
    theme: {
      label: string;
      dark: string;
      light: string;
      system: string;
    };
    audio: {
      label: string;
      enable: string;
      volume: string;
      disable: string;
    };
    language: {
      label: string;
    };
    scale: {
      label: string;
      small: string;
      medium: string;
      large: string;
    };
    editMode: {
      label: string;
      text: string;
      section: string;
      markdown: string;
      phonetic: string;
    };
    translation: {
      label: string;
      show: string;
      hide: string;
    };
    actions: {
      default: string;
      save: string;
      close: string;
    };
    about: {
      version: string;
      github: string;
      docs: string;
    };
  };

  tooltips: {
    hideSidebar: string;
    showSidebar: string;
    lyricsTab: string;
    musicalTab: string;
    /** Tooltip shown on the Player tab */
    playerTab?: string;
    import: string;
    export: string;
    versions: string;
    undo: string;
    redo: string;
    reset: string;
    aiUnavailable: string;
    aiUnavailableHelp: string;
    quantize: string;
    analyzeTheme: string;
    regenerate: string;
    collapseLeft: string;
    collapseRight: string;
    theme: string;
    audioFeedback: string;
    appInfo: string;
    addSection: string;
    removeSection: string;
    normalizeStructure: string;
    loadSession: string;
    pasteLyrics: string;
    generateSong: string;
    regenerateSection: string;
    quantizeSection: string;
    adaptSong: string;
    sectionAdapt: string;
    markupMode: string;
    phoneticMode: string;
    textMode: string;
    editorMode: string;
    applyAnalysis: string;
    revertAnalysis: string;
    closeAnalysis: string;
    generateMusical: string;
    keyboardShortcuts: string;
    closeAbout: string;
    analysisCancel: string;
    analysisImport: string;
    checkSimilarity: string;
    copyPrompt: string;
    generateTitle: string;
    aiGeneratedTitle: string;
    userEnteredTitle: string;
    openSearch: string;
    closeDialog: string;
    processing: string;
    removeFromLibrary: string;
    removeFromLibraryItem: string;
    openLeftPanel: string;
    closeLeftPanel: string;
    detectLanguage: string;
    redetectLanguage: string;
    moodPresets: string;
    rhymeScheme: string;
    targetSyllables: string;
    viewMode: string;
    newLyricsGeneration: string;
    newSong: string;
    pasteAvailable: string;
    pasteUnavailable: string;
    browseLibrary: string;
    openSettings: string;
    sponsor: string;
    sendToLyriaConfirm?: string;
    sendToLyria?: string;
    quantizeLineDone?: string;
    /** Tooltip shown on the Copy Lyrics button */
    copyLyrics?: string;
    /** Tooltip shown after lyrics have been successfully copied to clipboard */
    copyLyricsConfirm?: string;
    /** Tooltip shown on the Copy Musical Prompt button */
    copyMusicalPrompt?: string;
    /** Tooltip shown after musical prompt has been successfully copied to clipboard */
    copyMusicalPromptConfirm?: string;
    /** Aria-label for the voice assistant button (idle state) */
    voiceAssistant?: string;
    /** Status label while the mic is actively listening */
    voiceListening?: string;
    /** Status label while AI is processing the voice input */
    voiceProcessing?: string;
    /** Status label while the assistant is speaking the response */
    voiceSpeaking?: string;
  };

  sections: {
    intro: string;
    verse: string;
    preChorus: string;
    chorus: string;
    bridge: string;
    breakdown: string;
    finalChorus: string;
    outro: string;
  };

  moods: {
    aggressive: string;
    calm: string;
    dark: string;
    energetic: string;
    ethereal: string;
    funky: string;
    gloomy: string;
    happy: string;
    intense: string;
    joyful: string;
    lonely: string;
    majestic: string;
    melancholic: string;
    nostalgic: string;
    optimistic: string;
    peaceful: string;
    quirky: string;
    romantic: string;
    sad: string;
    tense: string;
    uplifting: string;
    vibrant: string;
    whimsical: string;
    yearning: string;
    zen: string;
  };

  insights?: {
    title: string;
    sections: string;
    words: string;
    characters: string;
  };

  rhymeSchemes?: {
    AABB: string;
    ABAB: string;
    AAAA: string;
    ABCB: string;
    AAABBB: string;
    AABBCC: string;
    ABABAB: string;
    ABCABC: string;
    FREE: string;
  };

  apiError?: {
    title: string;
    close: string;
  };

  adaptationProgress?: {
    adapting: string;
    reversing: string;
    reviewing: string;
    done: string;
    fidelityScore: string;
    reviewRecommended: string;
    pipelineFailed: string;
    dismissResult: string;
  };

  confirmModal?: {
    regenerateTitle: string;
    regenerateConfirm: string;
    cancel: string;
  };

  promptModal?: {
    saveVersionTitle: string;
    saveVersionMessage: string;
    saveVersionPlaceholder: string;
    saveVersionConfirm: string;
    cancel: string;
  };

  rhythmicCoherence?: {
    title: string;
    scoreLabel: string;
    optionA: string;
    optionADescription: string;
    optionB: string;
    optionBDescription: string;
    apply: string;
    skip: string;
    suggestedBpm: string;
    tooLongLines: string;
  };
}
