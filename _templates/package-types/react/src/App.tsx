import { css } from '@styled-system/css';
import type { ReactNode } from 'react';

export default function App(): ReactNode {
  return (
    <main className={styles.container}>
      <h1 className={styles.heading}>__NAME__</h1>
      <p className={styles.subtitle}>__DESCRIPTION__</p>
      <p className={styles.hint}>
        Edit <code>src/App.tsx</code> and save to reload.
      </p>
    </main>
  );
}

const styles = {
  container: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
    gap: '4',
  }),
  heading: css({
    fontSize: '3xl',
    fontWeight: 'bold',
    color: 'primary.500',
  }),
  subtitle: css({
    fontSize: 'lg',
    color: 'text.secondary',
  }),
  hint: css({
    'fontSize': 'sm',
    'color': 'grey.400',
    '& code': {
      padding: '1',
      borderRadius: 'sm',
      backgroundColor: 'grey.100',
      fontFamily: 'monospace',
    },
  }),
};
