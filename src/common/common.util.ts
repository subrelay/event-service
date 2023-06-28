import * as Rollbar from 'rollbar';

export async function notifyError(error: Error, msg = '') {
  const rollbarAccessToken = process.env.ROLLBAR_ACCESS_TOKEN;
  if (rollbarAccessToken) {
    const rollbar = new Rollbar({
      accessToken: rollbarAccessToken,
      captureUncaught: true,
      captureUnhandledRejections: true,
      environment: process.env.NODE_ENV,
    });
    rollbar.error(error);
  }
}
