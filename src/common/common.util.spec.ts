import * as Rollbar from 'rollbar';
import { notifyError } from './common.util';
jest.mock('rollbar');

describe('notifyError', () => {
  it('should send error to Rollbar if access token is provided', async () => {
    const error = new Error('Test error');
    const mockedRollbar = jest.spyOn(Rollbar.prototype, 'error');
    process.env.ROLLBAR_ACCESS_TOKEN = 'test-access-token';

    await notifyError(error);

    expect(Rollbar).toHaveBeenCalledWith({
      accessToken: 'test-access-token',
      captureUncaught: true,
      captureUnhandledRejections: true,
      environment: process.env.NODE_ENV,
    });
    expect(mockedRollbar).toHaveBeenCalledWith(error);

    mockedRollbar.mockRestore();
    delete process.env.ROLLBAR_ACCESS_TOKEN;
  });

  it('should not send error to Rollbar if access token is not provided', async () => {
    const error = new Error('Test error');
    const mockedRollbar = jest.spyOn(Rollbar.prototype, 'error');
    delete process.env.ROLLBAR_ACCESS_TOKEN;

    await notifyError(error);

    expect(mockedRollbar).not.toHaveBeenCalled();
  });
});
