'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';

// ============================================================
// تب «دیتابیس جستجو» در پنل مدیریت
// بارگذاری فایل‌های TXT (بدون محدودیت حجم، آپلود استریمی) که
// باکس «شناسایی اکانت فیسبوک» در صفحه اصلی روی آن‌ها جستجو می‌کند.
// فایل‌ها روی سرور (ولیوم Railway) ذخیره می‌شوند.
// ============================================================

interface DbFile {
  name: string;
  sizeBytes: number;
  mtimeMs: number;
}

type UploadState = { percent: number; status: 'uploading' | 'done' | 'error'; error?: string };

function fmtBytes(n: number): string {
  if (!n || n <= 0) return '۰';
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

function fmtDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
  } catch {
    return '';
  }
}

export function SearchDbTab() {
  const [files, setFiles] = useState<DbFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/searchdb');
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error ?? 'خطا در دریافت فهرست');
      setFiles(j.files ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // آپلود استریمی با XHR (نمایش درصد پیشرفت) — بدون محدودیت حجم
  const uploadFile = (file: File) =>
    new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/admin/searchdb/upload?name=${encodeURIComponent(file.name)}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploads((u) => ({ ...u, [file.name]: { percent, status: 'uploading' } }));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploads((u) => ({ ...u, [file.name]: { percent: 100, status: 'done' } }));
        } else {
          let msg = 'آپلود ناموفق بود';
          try {
            msg = JSON.parse(xhr.responseText)?.error ?? msg;
          } catch {
            /* ignore */
          }
          setUploads((u) => ({ ...u, [file.name]: { percent: 100, status: 'error', error: msg } }));
        }
        resolve();
      };
      xhr.onerror = () => {
        setUploads((u) => ({ ...u, [file.name]: { percent: 100, status: 'error', error: 'خطای شبکه' } }));
        resolve();
      };
      // ارسال فایل به‌صورت خام (بدون multipart) — استریم مستقیم به سرور
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(file);
    });

  const handleFiles = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploads((u) => {
      const next = { ...u };
      for (const f of arr) next[f.name] = { percent: 0, status: 'uploading' };
      return next;
    });
    // ترتیبی — تا چند فایل حجیم همزمان RAM/پهنای‌باند را نسوزانند
    for (const f of arr) {
      await uploadFile(f);
    }
    await load();
    // پاک‌سازی وضعیت آپلودهای موفق بعد از چند ثانیه
    setTimeout(() => {
      setUploads((u) => {
        const next = { ...u };
        for (const f of arr) {
          if (next[f.name]?.status === 'done') delete next[f.name];
        }
        return next;
      });
    }, 4000);
  };

  const removeFile = async (name: string) => {
    if (!window.confirm(`فایل «${name}» حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    setDeleting(name);
    try {
      const res = await fetch(`/api/admin/searchdb?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error ?? 'حذف ناموفق بود');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص');
    } finally {
      setDeleting(null);
    }
  };

  const totalBytes = files.reduce((a, f) => a + f.sizeBytes, 0);
  const activeUploads = Object.entries(uploads).filter(([, s]) => s.status === 'uploading');

  return (
    <Card className="border-border/80 bg-white soft-shadow">
      <CardContent className="p-3 sm:p-5 space-y-4">
        {/* سربرگ */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0">
            <Database className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-sm sm:text-base leading-tight">دیتابیس جستجو (فایل‌های TXT)</h2>
            <p className="text-[11px] text-muted-foreground leading-5">
              فایل‌ها روی سرور ذخیره می‌شوند و در باکس «شناسایی اکانت فیسبوک» صفحه اصلی برای همه کاربران جستجو می‌شوند —
              در صورت یافتن، کل سطرِ حاوی مورد نمایش داده می‌شود.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 px-2.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="hidden sm:inline text-xs">به‌روزرسانی</span>
          </Button>
        </div>

        {/* ناحیه آپلود */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed transition-colors p-5 sm:p-6 text-center ${
            dragOver ? 'border-blue-500/60 bg-blue-500/[0.06]' : 'border-border bg-secondary/30'
          }`}
        >
          <UploadCloud className="w-8 h-8 mx-auto mb-2 text-blue-600/70" />
          <p className="text-xs sm:text-sm font-bold">فایل‌های TXT را اینجا رها کنید یا انتخاب کنید</p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-5">
            بدون محدودیت حجم — آپلود استریمی و حافظه‌بهینه برای فایل‌های چندگیگابایتی · چند فایل هم‌زمان
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.csv,.log,.tsv,.dat,text/plain"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            size="sm"
            className="mt-3 h-9 px-4 font-bold bg-gradient-to-l from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white"
          >
            <UploadCloud className="w-4 h-4" /> انتخاب فایل‌ها
          </Button>
        </div>

        {/* وضعیت آپلودها */}
        {activeUploads.length > 0 && (
          <div className="space-y-2">
            {activeUploads.map(([name, st]) => (
              <div key={name} className="rounded-xl border border-blue-500/25 bg-blue-500/[0.05] px-3.5 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                  <span className="text-[11px] font-bold truncate" dir="ltr">
                    {name}
                  </span>
                  <span className="text-[10px] text-muted-foreground ltr-num ms-auto">{st.percent}٪</span>
                </div>
                <div className="h-1.5 rounded-full bg-blue-950/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-blue-500 to-indigo-400 transition-all duration-300"
                    style={{ width: `${st.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* خطا / موفقیت آپلود */}
        {Object.entries(uploads).some(([, s]) => s.status === 'error') && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {Object.entries(uploads)
                .filter(([, s]) => s.status === 'error')
                .map(([name, s]) => (
                  <p key={name}>
                    <b dir="ltr">{name}</b>: {s.error ?? 'آپلود ناموفق'}
                  </p>
                ))}
            </div>
          </div>
        )}
        {Object.values(uploads).some((s) => s.status === 'done') && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> فایل(ها) با موفقیت روی سرور ذخیره شد
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* فهرست فایل‌ها */}
        <div className="rounded-xl border border-border/70 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2 bg-secondary/40 border-b border-border/60">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold">فایل‌های ذخیره‌شده</span>
            <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">
              <span className="ltr-num">{files.length}</span> فایل
            </Badge>
            <Badge variant="outline" className="text-[9px] border-border text-muted-foreground gap-1">
              <HardDrive className="w-3 h-3" />
              <span className="ltr-num">{fmtBytes(totalBytes)}</span>
            </Badge>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> در حال دریافت…
            </div>
          ) : files.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground leading-6">
              هنوز فایلی بارگذاری نشده است. فایل‌های TXT دیتابیس را از کادر بالا بارگذاری کنید.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {files.map((f) => (
                <div key={f.name} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <FileText className="w-4 h-4 text-blue-600/70 shrink-0" />
                  <span className="text-xs font-bold truncate flex-1" dir="ltr">
                    {f.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground ltr-num shrink-0">{fmtBytes(f.sizeBytes)}</span>
                  <span className="text-[10px] text-muted-foreground/70 shrink-0 hidden sm:inline">{fmtDate(f.mtimeMs)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeFile(f.name)}
                    disabled={deleting === f.name}
                    className="h-8 px-2 border-rose-500/25 text-rose-600 hover:bg-rose-500/10 shrink-0"
                    aria-label={`حذف ${f.name}`}
                  >
                    {deleting === f.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
