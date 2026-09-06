// Cloudflare Pages Function
// Route: /api/lookup?isbn=9788934985471
// Looks up book info (title/author/cover) via Kakao's book search API.
//
// Why Kakao instead of Aladin: Aladin shut down its OpenAPI (new key issuance
// ended 2026-09-04, existing keys stop working 2026-10-30), so this proxies
// Kakao's search API instead, which is still active and self-service.
//
// Setup:
// 1. Go to https://developers.kakao.com -> 로그인 -> 내 애플리케이션 -> 애플리케이션 추가하기
// 2. Open the app -> 앱 키 -> copy the "REST API 키"
// 3. In Cloudflare Pages project settings -> Environment variables, add:
//      KAKAO_REST_API_KEY = <the REST API key>
// 4. Redeploy so the variable is picked up.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const rawIsbn = url.searchParams.get('isbn') || '';
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, '');

  if (!isbn) {
    return jsonResponse({ error: 'ISBN이 필요해요.' }, 400);
  }

  const kakaoKey = env.KAKAO_REST_API_KEY;
  if (!kakaoKey) {
    return jsonResponse({ error: '서버에 카카오 REST API 키가 설정되어 있지 않아요. Cloudflare Pages 환경 변수 KAKAO_REST_API_KEY를 등록해주세요.' }, 500);
  }

  const apiUrl = 'https://dapi.kakao.com/v3/search/book?target=isbn&query=' + encodeURIComponent(isbn);

  try {
    const res = await fetch(apiUrl, {
      headers: { 'Authorization': 'KakaoAK ' + kakaoKey }
    });

    if (!res.ok) {
      if (res.status === 401) {
        return jsonResponse({ error: '카카오 REST API 키가 올바르지 않아요.' }, 502);
      }
      return jsonResponse({ error: '카카오 API 오류 (' + res.status + ')' }, 502);
    }

    const data = await res.json();
    const item = data.documents && data.documents[0];
    if (!item) {
      return jsonResponse({ error: '해당 ISBN으로 책을 찾을 수 없어요.' }, 404);
    }

    return jsonResponse({
      isbn: isbn,
      title: (item.title || '').trim(),
      author: (item.authors || []).join(', '),
      publisher: item.publisher || '',
      cover: item.thumbnail || '',
      link: item.url || ''
    });
  } catch (fetchErr) {
    return jsonResponse({ error: '카카오 서버에 연결하지 못했어요.' }, 502);
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
