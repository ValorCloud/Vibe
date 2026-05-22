/**
 * RibbonTabs — lyrics / musical / player tab strip for TopRibbon.
 * Reads activeTab + setActiveTab from useAppNavigationContext directly.
 */
import React from 'react';
import { motion } from 'motion/react';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../i18n';
import { useAppNavigationContext } from '../../contexts/AppStateContext';

export function RibbonTabs() {
  const { activeTab, setActiveTab, setIsLeftPanelOpen } = useAppNavigationContext();
  const { t } = useTranslation();

  return (
    <>
      <Tooltip title={t.tooltips.lyricsTab}>
        <button
          onClick={() => setActiveTab('lyrics')}
          className={`text-[10px] uppercase tracking-widest transition-all duration-200 relative py-5 font-semibold ${
            activeTab === 'lyrics'
              ? 'text-[var(--accent-color)]'
              : 'text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-400'
          }`}
        >
          {t.ribbon.lyrics}
          {activeTab === 'lyrics' && (
            <motion.div layoutId="activeTab" className="absolute bottom-[6px] left-0 right-0 h-0.5 bg-[var(--accent-color)]" />
          )}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.musicalTab}>
        <button
          onClick={() => setActiveTab('musical')}
          className={`text-[10px] uppercase tracking-widest transition-all duration-200 relative py-5 font-semibold ${
            activeTab === 'musical'
              ? 'text-[var(--lcars-amber)]'
              : 'text-zinc-600 dark:text-zinc-500 hover:text-[var(--lcars-amber)]'
          }`}
        >
          {t.ribbon.musical}
          {activeTab === 'musical' && (
            <motion.div layoutId="activeMusicalTab" className="absolute bottom-[6px] left-0 right-0 h-0.5 bg-[var(--lcars-amber)]" />
          )}
        </button>
      </Tooltip>
      <Tooltip title={t.tooltips.playerTab ?? 'Player'}>
        <button
          onClick={() => {
            setActiveTab('player');
            setIsLeftPanelOpen(false);
          }}
          className={`text-[10px] uppercase tracking-widest transition-all duration-200 relative py-5 font-semibold ${
            activeTab === 'player'
              ? 'text-[var(--lcars-blue,#7eb3d8)]'
              : 'text-zinc-600 dark:text-zinc-500 hover:text-[var(--lcars-blue,#7eb3d8)]'
          }`}
        >
          {t.ribbon.player ?? 'PLAYER'}
          {activeTab === 'player' && (
            <motion.div layoutId="activePlayerTab" className="absolute bottom-[6px] left-0 right-0 h-0.5 bg-[var(--lcars-blue,#7eb3d8)]" />
          )}
        </button>
      </Tooltip>
    </>
  );
}
