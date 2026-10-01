import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import fs from 'fs';
import fsp from 'fs/promises';
import { getSessionUserDb } from '@/lib/auth';
import { sanitizeFileName, searchDbDir } from '@/lib/searchdb';

export const runtime = 'nodejs';
// آپلود فایل‌های حجیم — بدون محدودیت حجم
export const maxDuration = 600;

// POST /api/admin/searchdb/upload?name=... — آپلود استریمی فایل TXT (فقط ادمین)
// بدنه: محتوای خام فایل (application/octet-stream) — حافظه ثابت، مناسب گیگابایت‌ها
export async function POST(req: NextRequest) {
  const session = await getSessionUserDb(req);
  if (!session) return NextResponse.json({ error: 'نشست منقضی شده — دوباره وارد شو' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 });
  if (!req.body) return NextResponse.json({ error: 'بدنه فایل خالی است' }, { status: 400 });

  const rawName = req.nextUrl.searchParams.get('name') ?? '';
  const name = sanitizeFileName(rawName || `db-${Date.now()}.txt`);
  const dir = searchDbDir();
  const target = `${dir}/${name}`;

  try {
    // فایل موقت و سپس تغییر نام — تا آپلود نیمه‌کاره هرگز در نتایج جستجو دیده نشود
    const tmp = `${target}.uploading-${Date.now()}`;
    const write = fs.createWriteStream(tmp, { flags: 'w' });
    await pipeline(Readable.fromWeb(req.body as unknown as NodeWebReadableStream), write);
    // اطمینان از کامل نوشته‌شدن روی دیسک
    const fh = await fs.promises.open(tmp, 'r+');
    await fh.sync();
    await fh.close();
    await fs.promises.rename(tmp, target);
    const st = await fsp.stat(target);
    return NextResponse.json({ ok: true, name, sizeBytes: st.size });
  } catch (e) {
    console.error('searchdb upload error:', e);
    return NextResponse.json({ error: 'آپلود ناموفق بود — دوباره تلاش کنید' }, { status: 500 });
  }
}
