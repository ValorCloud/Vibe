import { createContext, useContext, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

const InterfaceMotionContext = createContext(false);

export function InterfaceMotionProvider({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <InterfaceMotionContext.Provider value={disabled}>
      <MotionConfig reducedMotion={disabled ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </InterfaceMotionContext.Provider>
  );
}

export function useInterfaceMotionDisabled() {
  return useContext(InterfaceMotionContext);
}
