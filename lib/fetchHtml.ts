'use server';

export async function fetchRawHtml(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) throw new Error(`Failed to fetch URL directly: ${res.status} ${res.statusText}`);
    
    const rawHtml = await res.text();
    if (!rawHtml) throw new Error('No content extracted from the URL');
    
    return rawHtml;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}
