import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './monitoring-error.filter';
import * as CommonUtil from './common.util';

jest.mock('./common.util.ts');

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let res;
  let host;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    res = {
      status: jest.fn().mockImplementation(() => {
        return res;
      }),
      json: jest.fn().mockImplementation(() => {
        return res;
      }),
    };

    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValueOnce(res),
      }),
    } as any;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should catch HttpException and set the response status and body', async () => {
    const exception = new HttpException('test-message', HttpStatus.BAD_REQUEST);
    jest.spyOn(CommonUtil, 'notifyError').mockResolvedValueOnce(undefined);

    await filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith(exception.message);
    expect(CommonUtil.notifyError).not.toHaveBeenCalled();
  });

  it('should catch any other exception', async () => {
    const exception = new Error('Test Error');
    jest.spyOn(CommonUtil, 'notifyError').mockResolvedValueOnce(undefined);

    await filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith({ message: 'Something went wrong' });
    expect(CommonUtil.notifyError).toHaveBeenCalledWith(exception);
  });
});
