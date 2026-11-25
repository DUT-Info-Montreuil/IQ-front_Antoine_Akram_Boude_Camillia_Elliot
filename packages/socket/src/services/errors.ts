import { StatusCodes } from "http-status-codes"

type DomainErrorStatus =
  | StatusCodes.BAD_REQUEST
  | StatusCodes.FORBIDDEN
  | StatusCodes.NOT_FOUND
  | StatusCodes.REQUEST_TOO_LONG
  | StatusCodes.UNSUPPORTED_MEDIA_TYPE
  | StatusCodes.UNPROCESSABLE_ENTITY
  | StatusCodes.INTERNAL_SERVER_ERROR

export class DomainError extends Error {
  readonly key: string
  readonly status: DomainErrorStatus

  constructor(key: string, status: DomainErrorStatus) {
    super(key)
    this.key = key
    this.status = status
  }
}

export const notFound = (key: string) =>
  new DomainError(key, StatusCodes.NOT_FOUND)

export const invalidInput = (key: string) =>
  new DomainError(key, StatusCodes.BAD_REQUEST)

export const forbidden = (key: string) =>
  new DomainError(key, StatusCodes.FORBIDDEN)

export const tooLarge = (key: string) =>
  new DomainError(key, StatusCodes.REQUEST_TOO_LONG)

export const unprocessable = (key: string) =>
  new DomainError(key, StatusCodes.UNPROCESSABLE_ENTITY)

export const unsupportedMediaType = (key: string) =>
  new DomainError(key, StatusCodes.UNSUPPORTED_MEDIA_TYPE)

export const serverError = (key: string) =>
  new DomainError(key, StatusCodes.INTERNAL_SERVER_ERROR)
