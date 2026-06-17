import aposResponse from "../lib/aposResponse";

export async function ALL({ params, request, redirect }) {
  try {
    const response = await aposResponse(request);
    if ([301, 302, 307, 308].includes(response.status)) {
      return redirect(response.headers.get('location'), response.status);
    }
    return response;
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};
