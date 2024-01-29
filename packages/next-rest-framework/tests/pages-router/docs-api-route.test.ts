import { DEFAULT_CONFIG, getConfig, getHtmlForDocs } from '../../src/shared';
import { ValidMethod } from '../../src/constants';
import { createMockApiRouteRequest } from '../utils';
import {
  type DocsProvider,
  type NextRestFrameworkConfig
} from '../../src/types';
import { docsApiRoute } from '../../src/pages-router';

describe('docsApiRoute', () => {
  it('uses the default config by default', async () => {
    expect(docsApiRoute()._nextRestFrameworkConfig).toEqual(DEFAULT_CONFIG);
  });

  it('sets the global config', async () => {
    const customConfig: NextRestFrameworkConfig = {
      openApiObject: {
        info: {
          title: 'Some Title',
          version: '1.2.3'
        }
      },
      openApiJsonPath: '/foo/bar'
    };

    expect(docsApiRoute(customConfig)._nextRestFrameworkConfig).toEqual(
      getConfig(customConfig)
    );
  });

  it.each(['redoc', 'swagger-ui'] satisfies DocsProvider[])(
    'returns the docs HTML: %s',
    async (provider) => {
      const { req, res } = createMockApiRouteRequest({
        method: ValidMethod.GET,
        path: '/api'
      });

      const _config: NextRestFrameworkConfig = {
        docsConfig: {
          provider,
          title: 'foo',
          description: 'bar',
          faviconUrl: 'baz.ico',
          logoUrl: 'qux.jpeg'
        }
      };

      await docsApiRoute(_config)(req, res);

      const text = res._getData();

      const html = getHtmlForDocs({
        config: getConfig(_config),
        host: 'localhost:3000'
      });

      expect(text).toEqual(html);
      expect(text).toContain('foo');
      expect(text).toContain('bar');
      expect(text).toContain('baz.ico');
    }
  );
});
