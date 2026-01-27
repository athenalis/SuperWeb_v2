import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import api from "../../lib/axios";

/* =========================
   HELPERS
========================= */
const statusStyle = {
  Diposting: "bg-emerald-500 text-white",
  Terjadwal: "bg-sky-500 text-white",
  Diblokir: "bg-slate-800 text-slate-100",
  Dibatalkan: "bg-rose-500 text-white",
  "Sedang Dibuat": "bg-amber-100 text-amber-700",
  Draf: "bg-slate-100 text-slate-600",
};

const renderLink = (link) => {
  if (!link) return "-";
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-700 underline break-all"
    >
      {link}
    </a>
  );
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatRupiah = (value) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (isNaN(num) || num === 0) return "-";
  return `Rp ${num.toLocaleString("id-ID")}`;
};

export function formatFollowers(num) {
  if (!num) return "-";
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(1).replace(".0", "") + " jt";
  if (num >= 1_000)
    return (num / 1_000).toFixed(1).replace(".0", "") + " rb";
  return num.toString();
}

const calcAdsDuration = (start, end) => {
  if (!start || !end) return "-";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff =
    Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? `${diff} hari` : "-";
};

function Section({ title, children }) {
  return (
    <div className="mt-10 space-y-5">
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-6 bg-blue-900 rounded-full" />
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>;
}

function Field({ label, value, full = false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="border rounded-lg px-5 py-4 space-y-1 bg-white">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className="text-base text-black">
          {value === null || value === undefined || value === "" ? "-" : value}
        </div>
      </div>
    </div>
  );
}

function getPlatformIcon(name) {
  switch (name) {
    case "TikTok":
      // Ikon ini lebih "nurut" kalau diatur ukurannya
      return { icon: "ic:baseline-tiktok", size: 22 };
    case "Instagram":
      return { icon: "skill-icons:instagram", size: 22 };
    case "YouTube":
      return { icon: "logos:youtube-icon", size: 22 };
    case "Facebook":
      return { icon: "logos:facebook", size: 22 };
    case "X":
    case "Twitter":
      return { icon: "ri:twitter-x-line", size: 22 };
    default:
      return { icon: "mdi:web", size: 22 };
  }
}

function PlatformContentCard({ group }) {
  const platform = group?.platform;
  const ads = group?.ads;
  const contents = group?.contents || [];

  const platformIcon = getPlatformIcon(platform?.name);

  return (
    <div className="border rounded-xl p-5 bg-white space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* ICON WRAPPER */}
          <div className="flex items-center justify-center shrink-0">
            <Icon
              icon={platformIcon.icon}
              /* Pakai style inline supaya nggak ditimpa CSS lain */
              style={{
                width: `${platformIcon.size}px`,
                height: `${platformIcon.size}px`,
              }}
            />
          </div>

          {/* NAMA PLATFORM */}
          <div className="font-semibold text-slate-800 leading-none">
            {platform?.name}
          </div>
        </div>

        <div className="text-sm font-medium text-slate-600">
          {contents.length === 1
            ? contents[0]?.content_type?.name || "-"
            : `${contents.length} konten`}
        </div>
      </div>

      {/* BODY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        {/* LINK */}
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Link Konten</div>

          <div className="space-y-2">
            {contents.length === 0 ? (
              <div className="break-all">-</div>
            ) : (
              contents.map((cp) => (
                <div key={cp.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-800">
                      {cp.content_type?.name || "-"}
                    </div>

                    {cp.is_collaborator ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        collaborator
                      </span>
                    ) : null}
                  </div>

                  <div className="break-all">{cp.link ? renderLink(cp.link) : "-"}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ADS */}
        <div className="sm:pl-4 sm:border-l">
          <div className="text-xs text-slate-500 mb-0.5">Rentang Iklan</div>

          {ads ? (
            <div className="space-y-1">
              <div>
                {formatDate(ads.start_date)} – {formatDate(ads.end_date)}
              </div>
              <div className="text-slate-600">
                Total Durasi: {calcAdsDuration(ads.start_date, ads.end_date)}
              </div>
              {/* 💰 BUDGET ADS */}
              <div className="pt-3 text-xs text-slate-500">Anggaran Iklan</div>
              <div className="text-slate-800 font-semibold">
                {formatRupiah(ads.budget_ads)}
              </div>
            </div>
          ) : (
            <div>-</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function DetailContent() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/content-plans/${id}`)
      .then((res) => {
        const data = res.data.data || res.data;
        console.log("Detail Data Loaded:", data);
        setData(data);
      })
      .catch(() => setError("Gagal memuat detail konten"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="fixed inset-0 bg-slate-100 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-900"></div>
            <Icon
              icon="mdi:account-details"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-900"
              width="28"
            />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-800">Memuat Data</p>
            <p className="text-sm text-slate-500">Mohon tunggu sebentar...</p>
          </div>
        </div>
      </div>
    );

  if (error || !data) return <p className="text-center py-10 text-red-600">{error}</p>;

  /* =========================
     CONTENT TYPE BY PLATFORM
  ========================= */
  const getContentTypeName = (cp) => {
    return cp.content_type?.name || "-";
  };

  /* =========================
     BUDGET
  ========================= */
  const budgetContent = Number(data.budget_with_trashed?.budget_content ?? 0);

  const budgetAds = (data.ads || []).reduce(
    (sum, ad) => sum + Number(ad.budget_ads ?? 0),
    0
  );

  const totalBudget = budgetContent + budgetAds;

  const adsByPlatform = (data.ads || []).reduce((acc, ad) => {
    acc[ad.platform_id] = ad;
    return acc;
  }, {});

  /* =========================
     GROUP PLATFORM & CONTENT (DIGABUNG)
  ========================= */
  const groupedPlatforms = (data.content_platforms || []).reduce((acc, cp) => {
    const pid = cp?.platform?.id;
    if (!pid) return acc;

    if (!acc[pid]) {
      acc[pid] = {
        platform: cp.platform,
        ads: adsByPlatform[pid] || null,   // 🔥 FIX
        contents: [],
      };
    }

    acc[pid].contents.push(cp);
    return acc;
  }, {});

  const groupedPlatformList = Object.values(groupedPlatforms);

  return (
    <div className="bg-white rounded-2xl p-8 shadow max-w-8xl mx-auto">
      {/* HEADER */}
      <div className="relative pt-2 md:pt-4">
        <div className="flex items-center md:block">
          <h1
            className="
                text-2xl md:text-3xl font-bold text-blue-900
                text-left md:text-center
                pr-12 md:pr-0
              "
          >
            Detail Perencanaan Konten
          </h1>
        </div>

        <button
          onClick={() => navigate(`/content/${id}/edit`)}
          className="
              absolute right-0
              top-1/2 -translate-y-1/2
              w-10 h-10 md:w-11 md:h-11
              flex items-center justify-center
              rounded-lg border border-blue-900
              text-blue-900
              hover:bg-blue-900 hover:text-white
              transition
            "
        >
          <Icon icon="solar:pen-outline" width={18} />
        </button>
      </div>

      {/* INFORMASI */}
      <Section title="Informasi Konten">
        {/* TOTAL BUDGET (FULL) */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-5">
          <div className="text-sm font-medium text-blue-700">Total Anggaran</div>

          <div className="mt-1 text-2xl md:text-2xl font-bold text-blue-900">
            {formatRupiah(totalBudget)}
          </div>
        </div>

        {/* JUDUL | TANGGAL | STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field
            label="Judul Konten"
            value={
              <div className="min-h-[32px] flex items-center">{data.title}</div>
            }
          />

          <Field
            label="Tanggal Posting"
            value={
              <div className="min-h-[32px] flex items-center">
                {formatDate(data.posting_date)}
              </div>
            }
          />

          <Field
            label="Status"
            value={
              <span
                className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${statusStyle[data.status?.label] || "bg-slate-100 text-slate-700"
                  }`}
              >
                {data.status?.label || "-"}
              </span>
            }
          />
        </div>

        {/* DESKRIPSI (FULL) */}
        <div className="grid grid-cols-1">
          <Field
            label="Deskripsi"
            value={
              <div className="min-h-[64px] leading-relaxed">
                {data.description || "-"}
              </div>
            }
            full
          />
        </div>
      </Section>

      {/* PLATFORM & KONTEN */}
      <Section title="Platform & Konten">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {groupedPlatformList.map((group) => (
            <PlatformContentCard key={group.platform?.id} group={group} />
          ))}
        </div>
      </Section>

      {/* BUDGET & ADS */}
      <Section title="Anggaran & Iklan">
        <Grid>
          <Field label="Anggaran Konten" value={formatRupiah(budgetContent)} />
          <Field label="Total Anggaran Iklan" value={formatRupiah(budgetAds)} />
        </Grid>
      </Section>


      {/* INFLUENCER */}
      {data.influencers?.length > 0 && (
        <Section title="Influencer">
          <div className="space-y-4">
            {data.influencers.map((inf, idx) => (
              <div key={inf.id} className="border rounded-xl p-4 space-y-4">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                                  bg-blue-50 text-blue-900 font-bold"
                >
                  Influencer {idx + 1}: {inf.name}
                </div>
                <p className="text-sm text-slate-500 mb-3">
                  Influencer digunakan untuk membantu distribusi atau kolaborasi konten
                  sesuai platform yang dipilih.
                </p>

                {/* PLATFORM & FOLLOWERS */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {inf.platforms?.map((p, index) => {
                    const isFirstRow = index < 3;
                    const isFirstItemSecondRow = index === 3;
                    const platformIcon = getPlatformIcon(p.platform?.name);

                    return (
                      <div
                        key={p.id}
                        className={`
                            flex justify-between items-center border rounded-lg px-4 py-3
                            ${isFirstRow
                            ? "md:col-span-2"
                            : isFirstItemSecondRow
                              ? "md:col-span-3 md:col-start-1"
                              : "md:col-span-3"
                          }
                          `}
                      >
                        {/* LEFT: ICON + NAME */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <Icon
                              icon={platformIcon.icon}
                              style={{
                                width: `${platformIcon.size}px`,
                                height: `${platformIcon.size}px`,
                              }}
                            />
                          </div>

                          <div>
                            <div className="font-semibold">{p.platform?.name}</div>
                            <div className="text-xs text-slate-500">{p.username}</div>
                          </div>
                        </div>

                        {/* RIGHT: FOLLOWERS */}
                        <div className="font-bold">{formatFollowers(p.followers)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* CP */}
                {(inf.email || inf.contacts?.length > 0) && (
                  <div className="border-t pt-4">
                    <div className="font-bold mb-2">CP (Kontak Person)</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {inf.email && (
                        <div className="border rounded-lg px-4 py-3">
                          <div className="text-xs text-slate-500">Email</div>
                          <div>{inf.email}</div>
                        </div>
                      )}

                      {inf.contacts?.map((c, i) => (
                        <div key={i} className="border rounded-lg px-4 py-3">
                          <div className="text-xs text-slate-500">No. Telepon</div>
                          <div>{c}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex justify-end mt-10 pb-4">
        <button
          onClick={() => navigate("/content")}
          className="px-5 py-2.5 bg-slate-200 rounded-lg"
        >
          Kembali
        </button>
      </div>
    </div>
  );
}