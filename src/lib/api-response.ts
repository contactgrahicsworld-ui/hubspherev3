/**
 * Standardized API response helpers.
 * All API routes should use these for consistent response format.
 */

export function success<T>(data: T, message?: string) {
  const response: {
    success: true;
    data: T;
    message?: string;
  } = { success: true, data };
  if (message) {
    response.message = message;
  }
  return response;
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function error(
  message: string,
  code: string,
  statusCode?: number
) {
  return {
    success: false as const,
    error: message,
    code,
  };
}
