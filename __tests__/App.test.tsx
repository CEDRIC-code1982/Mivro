/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
// [MODIFIED] App moved to src/presentation/
import App from '../src/presentation/App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
