import type { Preview } from '@storybook/nextjs-vite';
import '../app/globals.css';
import MockDate from 'mockdate';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { AuthProvider } from '../app/context/AuthProvider';
import { ToastProvider } from '../app/context/ToastContext';
import { mswHandlers } from './msw-handlers';

initialize({ onUnhandledRequest: 'bypass' });

const preview: Preview = {
  decorators: [
    (Story) => (
      <ToastProvider>
        <AuthProvider>
          <div className="min-h-screen bg-black p-6 text-white">
            <Story />
          </div>
        </AuthProvider>
      </ToastProvider>
    ),
  ],
  loaders: [mswLoader],
  parameters: {
    msw: {
      handlers: mswHandlers,
    },
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
  async beforeEach() {
    localStorage.setItem('searchHistory', JSON.stringify(['Dune', 'Severance']));
    MockDate.set('2024-04-01T12:00:00Z');

    return () => {
      MockDate.reset();
    };
  },
};

export default preview;
