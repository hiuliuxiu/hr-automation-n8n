import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Biểu đồ vẽ bằng Recharts, màu lấy từ dải navy của ABC Tech. Mỗi biểu đồ trả lời một câu hỏi.
export const SERIES = ['#142f4c', '#3f7cac', '#93b7d3'];
const AXIS = { fontSize: 12, fill: '#5f6b7b', fontFamily: 'Plus Jakarta Sans' };
const ANIM = { animationDuration: 900, animationEasing: 'ease-out' };

function Tip({ active, payload, label, format = (v) => v, title }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <b>{title ? title(label) : label}</b>
      {payload.map((p) => (
        <div key={p.dataKey}><span className="k">{p.name}</span><b>{format(p.value)}</b></div>
      ))}
    </div>
  );
}

export function WeeklyBars({ data, height = 190 }) {
  const last = data.length - 1;
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="rgba(20,47,76,0.08)" />
          <XAxis dataKey="w" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'rgba(20,47,76,0.05)', radius: 8 }} content={<Tip title={(l) => `Tuần ${l.slice(1)}`} />} />
          <Bar dataKey="n" name="Hồ sơ" radius={[8, 8, 3, 3]} {...ANIM}>
            {data.map((d, i) => <Cell key={d.w} fill={i === last ? '#142f4c' : '#c9dbea'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiLines({ data, names, height = 220 }) {
  // trục dọc ôm số liệu thật, luôn thấy vạch mục tiêu 100%
  const vals = data.flatMap((r) => names.map((n) => r[n])).filter((v) => v != null);
  const lo = Math.min(60, Math.floor((Math.min(...vals, 100) - 5) / 10) * 10);
  const hi = Math.max(105, Math.ceil((Math.max(...vals, 100) + 5) / 10) * 10);
  const ticks = [];
  for (let v = lo; v <= hi; v += lo <= 0 || hi - lo > 80 ? 20 : 10) ticks.push(v);
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(20,47,76,0.08)" />
          <XAxis dataKey="p" tick={AXIS} axisLine={false} tickLine={false} padding={{ left: 10, right: 10 }} />
          <YAxis domain={[lo, hi]} ticks={ticks} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine y={100} stroke="#142f4c" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Tooltip content={<Tip format={(v) => `${v}%`} title={(l) => `Tuần ${l.slice(1)}`} />} />
          {names.map((n, i) => (
            <Line key={n} type="linear" dataKey={n} name={n} stroke={SERIES[i]} strokeWidth={2.5} dot={{ r: 3.5, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} {...ANIM} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SatisfactionArea({ data, height = 170 }) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -26, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(20,47,76,0.08)" />
          <XAxis dataKey="p" tick={AXIS} axisLine={false} tickLine={false} padding={{ left: 10, right: 10 }} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip format={(v) => `${v.toLocaleString('vi-VN')} / 5`} title={(l) => `Tuần ${l.slice(1)}`} />} />
          <Area type="linear" dataKey="avg" name="Hài lòng TB" stroke="#142f4c" strokeWidth={2.5} fill="#142f4c" fillOpacity={0.08} dot={{ r: 3.5, fill: '#fff', strokeWidth: 2 }} {...ANIM} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
