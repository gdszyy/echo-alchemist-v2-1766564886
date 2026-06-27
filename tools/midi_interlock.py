#!/usr/bin/env python3
"""
midi_interlock.py — 跨音轨「联动」分析器 (cross-track interaction miner)

与上一轮 midi_mine.py 的区别：
  上一轮：每个分轨**单独**给一条 16 分 onset 向量（孤立看）。
  本轮：把一个 Boss 的所有 stem 对齐到**同一条 bar / 16分栅格**，挖
        「多音轨在同一个乐句和小节中的联动」——
        ① bass↔kick 锁位还是错位填充
        ② 旋律声部(synth/vox/guitar) 是否在鼓的空拍里答句 (call-and-response)
        ③ bass 根音 与 synth/pad 的和声音程锁 (harmonic lock)
        ④ 乐句(4 小节)边界的齐奏重音 (who hits the downbeat together)
        ⑤ 编配时间线：每小节每声部音数 = 谁在何时进/退层

依赖：mido（带宽容 key-signature 补丁）。PPQ=480, 4/4 默认。
用法：python3 tools/midi_interlock.py "微裂母体"
      python3 tools/midi_interlock.py --all
"""
import sys, os, glob, math
from collections import defaultdict, Counter

import mido
from mido.midifiles import meta as _meta
class _Tol(dict):
    def __getitem__(self, k):
        try: return dict.__getitem__(self, k)
        except KeyError: return 'C'
_meta._key_signature_decode = _Tol(_meta._key_signature_decode)

BOSS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Audio_sample", "Boss")
STEP_PER_BAR = 16          # 16 分栅格
BARS_PER_PHRASE = 4
PC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

# GM 打击映射 → 角色
def drum_role(pitch):
    if pitch in (35,36): return 'K'      # kick
    if pitch in (38,40): return 'S'      # snare
    if pitch in (37,39): return 'R'      # rim/clap
    if pitch in (42,44): return 'H'      # closed hat
    if pitch in (46,)  : return 'O'      # open hat
    if pitch in (41,43,45,47,48,50): return 'T'  # tom
    if pitch in (49,57,51,59,52,55): return 'C'  # cymbal
    return 'x'

def stem_of(path):
    b = os.path.basename(path)
    return b.split("(")[1].rstrip(").mid ") if "(" in b else b

def load_boss(name):
    fs = sorted(glob.glob(os.path.join(BOSS_DIR, f"{name}*.mid")))
    fs = [f for f in fs if not f.lower().endswith(".zip")]
    stems = {}
    ppq = 480; tempo = 500000
    for f in fs:
        mf = mido.MidiFile(f)
        ppq = mf.ticks_per_beat
        notes = []  # (abs_tick, pitch, vel)
        for tr in mf.tracks:
            t = 0
            for m in tr:
                t += m.time
                if m.type == 'set_tempo': tempo = m.tempo
                if m.type == 'note_on' and m.velocity > 0:
                    notes.append((t, m.note, m.velocity))
        stems[stem_of(f)] = notes
    bpm = round(60_000_000 / tempo, 1)
    return stems, ppq, bpm

def to_grid(notes, ppq):
    """每个 onset → 全局 16 分 step 序号。返回 list[(step, pitch, vel)]。"""
    tps = ppq * 4 / STEP_PER_BAR   # ticks per 16th
    out = []
    for (t, p, v) in notes:
        step = int(round(t / tps))
        out.append((step, p, v))
    return out

def is_drum(stem): return 'Drum' in stem
def is_bass(stem): return 'Bass' in stem
def is_mel(stem):  return any(k in stem for k in ('Synth','Vocal','Guitar','Woodwind','FX','Lead'))

def analyze(name):
    stems, ppq, bpm = load_boss(name)
    grids = {s: to_grid(n, ppq) for s, n in stems.items()}
    max_step = max((st for g in grids.values() for (st, _, _) in g), default=0)
    total_bars = max_step // STEP_PER_BAR + 1
    mid_bar = total_bars // 2  # calm / rage 粗分

    print("=" * 78)
    print(f"BOSS  {name}    bpm={bpm}  ppq={ppq}  bars≈{total_bars}  (calm<{mid_bar}≤rage)")
    print("=" * 78)

    # ---- 每声部 per-step-in-bar onset 直方图（calm/rage 分段），鼓再拆角色 ----
    def hist(stem_filter, role_split=False, section=None):
        h = defaultdict(lambda: Counter())  # key -> Counter(step_in_bar)
        for s, g in grids.items():
            if not stem_filter(s): continue
            for (st, p, v) in g:
                bar = st // STEP_PER_BAR
                if section == 'calm' and bar >= mid_bar: continue
                if section == 'rage' and bar < mid_bar: continue
                sib = st % STEP_PER_BAR
                key = drum_role(p) if role_split else s
                h[key][sib] += 1
        return h

    def render_row(label, counter):
        cells = []
        for i in range(STEP_PER_BAR):
            c = counter.get(i, 0)
            cells.append('·' if c == 0 else ('▁▂▃▄▅▆▇█'[min(c-1, 7)]))
        # beat 分隔
        s = ''.join(cells[i] + ('|' if i % 4 == 3 else '') for i in range(STEP_PER_BAR))
        print(f"  {label:16s} {s}")

    for sec in ('calm', 'rage'):
        print(f"\n── {sec.upper()} ── (step-in-bar onset density, folded over all bars)")
        dh = hist(is_drum, role_split=True, section=sec)
        for role in ['K','S','R','H','O','T','C','x']:
            if role in dh: render_row(f"Drums:{role}", dh[role])
        bh = hist(is_bass, section=sec)
        for k, c in bh.items(): render_row(k, c)
        mh = hist(is_mel, section=sec)
        for k, c in mh.items(): render_row(k, c)

    # ---- ① bass ↔ kick 联动：每 step bass/kick 共现 ----
    print("\n① BASS ↔ KICK 联动 (folded 16-grid: K=kick only, B=bass only, ✦=both, ·=neither)")
    kick_steps = Counter(); bass_steps = Counter()
    for s, g in grids.items():
        for (st, p, v) in g:
            sib = st % STEP_PER_BAR
            if is_drum(s) and drum_role(p) == 'K': kick_steps[sib] += 1
            if is_bass(s): bass_steps[sib] += 1
    row = ''
    both = konly = bonly = 0
    for i in range(STEP_PER_BAR):
        k = kick_steps.get(i, 0) > total_bars * 0.10
        b = bass_steps.get(i, 0) > total_bars * 0.10
        ch = '✦' if (k and b) else ('K' if k else ('B' if b else '·'))
        both += (k and b); konly += (k and not b); bonly += (b and not k)
        row += ch + ('|' if i % 4 == 3 else '')
    print(f"   {row}")
    print(f"   lock={both} steps  kick-only={konly}  bass-only(fills)={bonly}  "
          f"→ {'INTERLOCK填充' if bonly>=both else '锁位unison'}")

    # ---- ② call-and-response：旋律 onset 落在鼓忙/闲拍的比例 ----
    print("\n② CALL-RESPONSE (旋律 onset 落在 drum 空拍 vs 忙拍)")
    drum_busy = Counter()
    for s, g in grids.items():
        if is_drum(s):
            for (st, p, v) in g: drum_busy[st] += 1
    for s, g in grids.items():
        if not is_mel(s) or len(g) < 8: continue
        gap = sum(1 for (st, p, v) in g if drum_busy.get(st, 0) == 0)
        tot = len(g)
        print(f"   {s:16s} {100*gap//tot:3d}% in drum-gaps ({gap}/{tot})  "
              f"→ {'答句(fills gaps)' if gap*2>=tot else '齐奏(on the hits)'}")

    # ---- ③ harmonic lock：bass 根 vs 旋律音程（折叠到 12 半音）----
    print("\n③ HARMONIC LOCK (每 bar：bass 最低音=根；旋律相对根的音程直方图)")
    # bass root per bar (lowest pitch onset in that bar)
    bass_root = {}
    for s, g in grids.items():
        if not is_bass(s): continue
        perbar = defaultdict(list)
        for (st, p, v) in g: perbar[st // STEP_PER_BAR].append(p)
        for bar, ps in perbar.items():
            bass_root[bar] = min(ps) if bar not in bass_root else min(bass_root[bar], min(ps))
    iv = Counter()
    for s, g in grids.items():
        if not is_mel(s) or 'FX' in s: continue
        for (st, p, v) in g:
            bar = st // STEP_PER_BAR
            if bar in bass_root:
                iv[(p - bass_root[bar]) % 12] += 1
    tot = sum(iv.values()) or 1
    names = {0:'1',1:'b2',2:'2',3:'b3',4:'3',5:'4',6:'b5',7:'5',8:'b6',9:'6',10:'b7',11:'7'}
    top = sorted(iv.items(), key=lambda x: -x[1])[:6]
    print("   " + "  ".join(f"{names[k]}={100*c//tot}%" for k, c in top))

    # ---- ④ 乐句边界齐奏：4 小节首拍 step0 同时发声的声部数 ----
    print("\n④ PHRASE DOWNBEAT 齐奏 (每 4 小节首拍 step0 同时 onset 的声部)")
    for ph in range(0, min(total_bars, 32), BARS_PER_PHRASE):
        step0 = ph * STEP_PER_BAR
        hitters = []
        for s, g in grids.items():
            if any(abs(st - step0) <= 1 for (st, p, v) in g): hitters.append(s.split(' ')[0][:4] if False else s)
        short = [ (('D' if is_drum(s) else 'B' if is_bass(s) else 'M')) for s in hitters ]
        print(f"   phrase@bar{ph:3d}: {len(hitters)} voices  [{','.join(sorted(set(hitters)))}]")

    # ---- ⑤ 编配时间线：每声部按 8 小节块的音数 ----
    print("\n⑤ ARRANGEMENT TIMELINE (每声部 / 每 8 小节 音数 → 谁何时进退层)")
    block = 8
    nblocks = total_bars // block + 1
    for s, g in grids.items():
        counts = [0] * nblocks
        for (st, p, v) in g:
            counts[(st // STEP_PER_BAR) // block] += 1
        spark = ''.join('·' if c == 0 else '▁▂▃▄▅▆▇█'[min(int(math.log2(c+1)), 7)] for c in counts)
        print(f"   {s:16s} {spark}")
    print()

if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] == '--all':
        names = sorted({os.path.basename(f).split(" (")[0] for f in glob.glob(os.path.join(BOSS_DIR, "*.mid"))})
        for n in names: analyze(n)
    else:
        analyze(args[0])
