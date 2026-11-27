const maxImageBytes = 8 * 1024 * 1024;
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

export async function recognizeRankingImage(request, env, origin, json) {
  if (request.headers.get('Origin') !== origin ||
      request.headers.get('Content-Type') !== 'image/png' || !request.body) {
    return json({ error: 'invalid_request', message: '请从当前站点上传 PNG 裁片。' }, 400);
  }

  const key = env.DEEPSEEK_API_KEY?.trim();
  if (!key) return json({ error: 'deepseek_not_configured', message: '请先配置 Worker Secret DEEPSEEK_API_KEY。' }, 503);

  try {
    const reader = request.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxImageBytes) {
          await reader.cancel();
          return json({ error: 'image_too_large', message: 'PNG 裁片超过 8 MiB。' }, 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const image = new Blob(chunks, { type: 'image/png' });
    const signature = new Uint8Array(await image.slice(0, pngSignature.length).arrayBuffer());
    if (pngSignature.some((value, index) => value !== signature[index])) {
      return json({ error: 'invalid_png', message: '裁片不是有效的 PNG 文件。' }, 400);
    }

    const form = new FormData();
    form.set('purpose', 'text_recognition');
    form.set('file', image, 'ranking-names.png');
    const response = await fetch('https://api.deepseek.com/v1/tools/ocr', {
      method: 'POST',
      redirect: 'manual',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
      signal: AbortSignal.timeout(185000)
    });
    if (!response.ok) {
      const message = response.status === 401 ? 'DeepSeek 拒绝了 API Key，请核对现有 Worker Secret。'
        : response.status === 402 ? 'DeepSeek API 余额不足。'
        : response.status === 429 ? 'DeepSeek 请求过多，请稍后重试。'
        : `DeepSeek OCR 返回 HTTP ${response.status}。`;
      return json({ error: 'deepseek_upstream', message }, response.status === 429 ? 429 : 502);
    }

    const result = await response.json();
    const page = result?.pages?.[0];
    if (result?.error || result?.pages?.length !== 1 || typeof page?.text !== 'string') {
      return json({ error: 'ocr_failed', message: 'DeepSeek OCR 未返回可用的裁片识别结果。' }, 502);
    }
    if (page.finish_reason !== 'stop') {
      return json({ error: 'ocr_incomplete', message: 'OCR 结果不完整，请检查裁片或手动填写机型。' }, 502);
    }
    return json({ text: page.text });
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'DeepSeek OCR 超时，请稍后重试。' : '暂时无法完成 DeepSeek OCR。';
    return json({ error: 'ocr_unavailable', message }, 502);
  }
}
