"""t2s.py - convert Traditional Chinese characters to Simplified in player-facing source.

The game mixes Traditional and Simplified on the same screens (audit:
docs/design/pixel_redesign/audit_menus_overlays.md). Spec docs/design/pixel_art_mode.md
§3.1 fixes the UI language to Simplified Chinese.

Only an explicit, unambiguous one-to-one table is used (no dictionary guessing);
characters whose simplification depends on context (e.g. 乾/干, 著/着, 髮/發→发
both) are deliberately absent. --scan lists remaining table hits AND every Han
character outside GB2312 (the table-independent check: a table can only find
characters it already knows).

    python tools/pixel_art/t2s.py --scan          # report counts per file
    python tools/pixel_art/t2s.py --apply         # rewrite files in place
"""
from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

PAIRS = (
    '煉炼 聲声 師师 開开 繼继 續续 戲戏 遺遗 選选 擇择 運运 饋馈 贈赠 種种 層层 數数 當当 試试 場场 書书 圖图 鑑鉴 鑒鉴 '
    '敵敌 狀状 態态 詞词 條条 傷伤 統统 計计 釘钉 盤盘 彈弹 純纯 淨净 戰战 擊击 護护 復复 進进 據据 給给 錯错 誤误 '
    '時时 間间 這这 個个 們们 為为 會会 點点 關关 閃闪 電电 風风 劍剑 飛飞 鳴鸣 響响 劇剧 環环 輪轮 轉转 鐘钟 錘锤 '
    '銷销 鎖锁 寶宝 貨货 幣币 價价 購购 買买 賣卖 爐炉 藥药 劑剂 礦矿 華华 衝冲 範范 圍围 與与 對对 將将 從从 後后 '
    '裡里 讓让 還还 發发 動动 變变 異异 級级 階阶 體体 頭头 顯显 標标 籤签 記记 錄录 說说 細细 節节 屬属 靈灵 獸兽 '
    '龍龙 鳥鸟 蟲虫 歡欢 來来 臨临 確确 認认 參参 齊齐 嚴严 險险 線线 網网 絡络 終终 結结 練练 習习 學学 業业 資资 '
    '費费 損损 壞坏 補补 強强 襲袭 衛卫 盡尽 機机 處处 過过 載载 優优 勢势 顆颗 塊块 帶带 張张 長长 門门 問问 題题 '
    '筆笔 畫画 類类 舊旧 雙双 單单 號号 鍵键 項项 設设 質质 啟启 閉闭 樂乐 頁页 憶忆 億亿 萬万 兩两 幾几 極极 決决 '
    '斷断 寫写 讀读 檔档 鑄铸 礎础 隨随 傳传 嗎吗 擴扩 縮缩 確确 實实 際际 驗验 證证 談谈 論论 議议 識识 譜谱 讚赞 '
    '輸输 贏赢 賽赛 獎奖 勵励 懲惩 罰罚 負负 擔担 搶抢 擁拥 擋挡 擾扰 攔拦 攝摄 撥拨 撐撑 擺摆 擬拟 據据 據据 '
    '屍尸 骸骸 魯鲁 鮮鲜 鋼钢 鐵铁 銅铜 銀银 鑽钻 錢钱 鏡镜 鍊链 鏈链 針针 釣钓 鈴铃 鋒锋 銳锐 鑰钥 銘铭 鋪铺 '
    '飾饰 飽饱 養养 餘余 館馆 驅驱 騎骑 驚惊 驟骤 魚鱼 鳳凤 麗丽 黃黄 齒齿 龜龟 韌韧 頓顿 順顺 須须 預预 領领 頻频 '
    '顏颜 額额 願愿 顧顾 颱台 題题 類类 顛颠 爾尔 牆墙 獄狱 獨独 獵猎 現现 瑣琐 産产 畢毕 異异 療疗 盜盗 監监 '
    '盞盏 碼码 礙碍 禮礼 禦御 稱称 穩稳 窮穷 竊窃 競竞 築筑 簡简 糧粮 紀纪 約约 紅红 級级 紛纷 紙纸 紋纹 純纯 '
    '組组 細细 終终 絕绝 給给 統统 絲丝 綁绑 經经 綠绿 維维 綜综 綻绽 緊紧 緒绪 線线 締缔 編编 緣缘 縫缝 縱纵 '
    '總总 績绩 繁繁 織织 繞绕 繪绘 繫系 纏缠 罷罢 羅罗 習习 聖圣 聞闻 聯联 聰聪 職职 聽听 肅肃 脈脉 脫脱 腦脑 '
    '膽胆 臉脸 臟脏 興兴 舉举 艦舰 艙舱 艱艰 莊庄 葉叶 蒼苍 蓋盖 蔣蒋 蘇苏 處处 虛虚 號号 蝕蚀 蠍蝎 衆众 術术 '
    '衝冲 補补 裝装 製制 複复 襯衬 規规 視视 覺觉 覽览 觀观 觸触 訂订 訊讯 討讨 訓训 託托 記记 訪访 設设 許许 '
    '訴诉 診诊 註注 詐诈 評评 詞词 詢询 試试 詩诗 誇夸 誌志 認认 誘诱 語语 誠诚 說说 誰谁 課课 調调 請请 諸诸 '
    '謀谋 謎谜 講讲 謝谢 證证 譯译 護护 變变 讓让 豐丰 豬猪 貓猫 貝贝 負负 財财 責责 貫贯 貪贪 貴贵 貼贴 賞赏 '
    '賦赋 質质 賭赌 賴赖 購购 贈赠 贊赞 趕赶 趨趋 躍跃 車车 軌轨 軍军 軟软 較较 載载 輔辅 輕轻 輝辉 輩辈 轟轰 '
    '辦办 農农 迴回 週周 逆逆 遊游 運运 過过 達达 違违 遠远 適适 遲迟 遷迁 遺遗 邊边 邏逻 鄰邻 醫医 釋释 '
    '針针 鈍钝 鉤钩 銜衔 鋒锋 錦锦 鍛锻 鎮镇 鏽锈 鑲镶 長长 閃闪 閒闲 閘闸 閱阅 闊阔 闖闯 隊队 陰阴 陣阵 陳陈 '
    '陸陆 陽阳 隱隐 隸隶 雜杂 雞鸡 離离 難难 雲云 電电 霧雾 靜静 靂雳 韋韦 響响 頂顶 項项 順顺 頰颊 頸颈 頹颓 '
    '顆颗 驗验 驅驱 髒脏 鬆松 鬥斗 鬧闹 鬱郁 魂魂 鳴鸣 鷹鹰 鹽盐 麥麦 麼么 黨党 點点 齡龄 齊齐 '
    '構构 樣样 標标 槍枪 樓楼 權权 橫横 樹树 橋桥 檢检 櫃柜 歲岁 歸归 殘残 殺杀 殼壳 毀毁 氣气 汙污 決决 '
    '沒没 況况 減减 測测 渦涡 準准 溝沟 滅灭 滾滚 滿满 漸渐 潛潜 潰溃 澤泽 濃浓 濕湿 濾滤 瀏浏 灑洒 灘滩 灣湾 '
    '炮炮 為为 烏乌 無无 煙烟 熱热 熾炽 燈灯 營营 燦灿 燭烛 爭争 爺爷 牽牵 犧牺 狀状 狹狭 猶犹 獅狮 玀猡 環环 '
    '甦苏 畫画 異异 當当 疊叠 瘋疯 盡尽 盧卢 眾众 睜睁 矯矫 碎碎 碩硕 確确 磚砖 礦矿 祕秘 禍祸 種种 稅税 '
    '穌稣 窩窝 竄窜 筆笔 範范 箏筝 節节 範范 簽签 籃篮 籌筹 糾纠 紡纺 紮扎 絃弦 絆绊 綱纲 緞缎 緩缓 緯纬 練练 '
    '縣县 縛缚 縮缩 繩绳 繼继 續续 纖纤 罈坛 罰罚 羨羡 翹翘 聳耸 腳脚 膚肤 臥卧 臨临 舊旧 艷艳 藍蓝 藏藏 蘭兰 '
    '虧亏 蝦虾 蠟蜡 蠶蚕 衛卫 衝冲 裏里 褲裤 覓觅 覺觉 訣诀 詛诅 詭诡 謊谎 譏讥 譴谴 豎竖 貢贡 販贩 貧贫 貯贮 '
    '貿贸 賀贺 賊贼 賓宾 賤贱 賺赚 賽赛 贖赎 趙赵 跡迹 踐践 蹤踪 躉趸 軸轴 軼轶 輛辆 輯辑 輸输 轄辖 辭辞 遞递 '
    '遜逊 鄉乡 釀酿 鈔钞 鉛铅 銷销 鋤锄 錄录 鍋锅 鍾钟 鎊镑 鏟铲 鐘钟 鑰钥 閣阁 闆板 闌阑 闕阙 隕陨 隻只 雛雏 '
    '霸霸 霽霁 靄霭 韻韵 頌颂 頒颁 頗颇 頭头 頹颓 顫颤 颯飒 颶飓 飄飘 飆飙 餅饼 餓饿 馬马 馴驯 駐驻 駕驾 駭骇 '
    '騰腾 驢驴 骯肮 髮发 鬍胡 鬚须 魅魅 鯊鲨 鯨鲸 鱗鳞 鴉鸦 鵝鹅 鶴鹤 麵面 黴霉 鼴鼹 齋斋 '
    '煉炼 鍊炼 鑪炉 遊游 盃杯 菸烟 粧妆 着着 鉅巨 侷局 啟启 嘆叹 嚮向 囪囱 堯尧 墊垫 壓压 壘垒 壯壮 '
    '奪夺 奮奋 妝妆 婦妇 媽妈 嬰婴 孫孙 學学 寧宁 實实 審审 寫写 寬宽 對对 尋寻 導导 層层 屬属 岡冈 峽峡 崗岗 '
    '嶄崭 巔巅 幫帮 幹干 廣广 廠厂 廢废 廳厅 彎弯 彙汇 徑径 從从 徵征 憂忧 憑凭 懷怀 戀恋 戶户 拋抛 挾挟 捨舍 '
    '掃扫 掛挂 揀拣 揚扬 換换 揮挥 損损 搖摇 摺折 撫抚 擊击 擠挤 擬拟 擴扩 擷撷 攜携 敗败 敘叙 斃毙 斬斩 於于 '
    '暈晕 暉晖 暢畅 暫暂 曆历 曉晓 曠旷 會会 朧胧 東东 棄弃 棧栈 棲栖 楓枫 業业 極极 榮荣 槓杠 樁桩 樞枢 '
    '內内 侶侣 倆俩 倉仓 僅仅 儲储 兒儿 冊册 凍冻 凱凯 劃划 劉刘 勁劲 務务 勝胜 勞劳 區区 協协 卻却 厲厉 叢丛 吳吴 呂吕 員员 '
    '喚唤 喪丧 嘯啸 嚇吓 囂嚣 國国 圓圆 團团 執执 堅坚 報报 塵尘 墜坠 墳坟 壇坛 壽寿 夢梦 夥伙 奧奥 奬奖 嬌娇 宮宫 寢寝 '
    '專专 尷尴 屆届 嶺岭 帥帅 帳帐 廟庙 彥彦 徹彻 恆恒 惡恶 惱恼 愛爱 慘惨 慣惯 慶庆 憐怜 應应 懸悬 懼惧 撲扑 擲掷 攏拢 '
    '攤摊 斂敛 曬晒 枴拐 棟栋 楊杨 樸朴 櫻樱 欄栏 沖冲 淪沦 渙涣 湧涌 滯滞 滲渗 漁渔 漲涨 澆浇 濺溅 瀉泻 燒烧 燙烫 燼烬 '
    '爛烂 猙狰 獰狞 獻献 瓊琼 產产 畝亩 瘡疮 癒愈 眞真 睏困 砲炮 礫砾 祿禄 禪禅 稟禀 穀谷 積积 窺窥 竅窍 筍笋 箋笺 籠笼 '
    '糰团 紳绅 紹绍 綫线 縷缕 繃绷 繡绣 纜缆 罵骂 羈羁 脅胁 脹胀 腫肿 膩腻 蓮莲 蔔卜 蕭萧 薦荐 薩萨 藝艺 蘊蕴 蘋苹 蝨虱 '
    '螢萤 蠻蛮 衊蔑 襪袜 見见 親亲 覷觑 誦诵 諷讽 諾诺 謂谓 謹谨 譁哗 譽誉 豈岂 貞贞 貸贷 賄贿 賜赐 賢贤 賬账 踴踊 軀躯 '
    '辯辩 遙遥 邁迈 郵邮 醜丑 鈕钮 銹锈 鋸锯 錐锥 鍍镀 鎧铠 鐮镰 闡阐 雖虽 霑沾 頃顷 頑顽 顎颚 飢饥 飼饲 餵喂 饑饥 馳驰 '
    '騙骗 騷骚 驕骄 髏髅 魘魇 鴻鸿 鵲鹊 鷗鸥 龐庞 牆墙 墻墙 嘗尝 黏黏 汎泛 '
    '歐欧 歷历 毆殴 氫氢 氯氯 涼凉 淚泪 淺浅 渾浑 湯汤 溫温 漢汉 潔洁 澀涩 濁浊 濱滨 瀆渎 瀝沥 瀰弥 灕漓 '
    # 独立复核（GB2312 外字检测）补出的漏网字；値/増 是日文新字体写法
    '連连 獲获 該该 佔占 義义 偽伪 値值 増增 塚冢 膠胶 稜棱 輻辐 爍烁 鉚铆 側侧 創创 噴喷 剛刚 幀帧 '
    '採采 匯汇 傾倾 備备 並并 閾阈 則则 亂乱 夠够 淵渊 係系 夾夹 湊凑 庫库 '
)

# 历史编码损坏留下的错字（不是繁体，按上下文逐条确认后修正）。
# 单字项只在本仓所有出现处都同义时才收（鑉 全部是「钉」：鑉子 / 鑉盘）。
MOJIBAKE = {
    '鑉': '钉',
    '屌底': '兜底',
    '汋试': '尝试',
    '建护': '建议',
    '輨达度': '辨识度',
    '燕炉守卫': '熔炉守卫',  # 首领伊格尼斯（全库文档均为「熔炉守卫」）
}

# GB2312 之外、但确属规范简体的字（目前没有）。--scan 把 GB2312 外的汉字全部列出，
# 不依赖上面的对照表——对照表只能发现「表里已有的字」，查不出漏网字。
ALLOW_OUTSIDE_GB2312 = set()


def build_table():
    table = {}
    for pair in PAIRS.split():
        if len(pair) != 2:
            continue
        t, s = pair[0], pair[1]
        if t != s:
            table[t] = s
    return table


TABLE = build_table()

TARGETS = ['index.html', 'src', 'tests']
SKIP_DIRS = {'node_modules', 'assets', 'archive'}
# 这些文件故意含繁体字作为「禁止出现」的反例正则，不能转换
SKIP_FILES = {'validate_ui_terminology.mjs'}
EXTS = {'.js', '.mjs', '.html', '.css'}


def iter_files():
    for t in TARGETS:
        p = os.path.join(ROOT, t)
        if os.path.isfile(p):
            yield p
            continue
        for dirpath, dirnames, filenames in os.walk(p):
            dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
            for fn in sorted(filenames):
                if os.path.splitext(fn)[1] in EXTS and fn not in SKIP_FILES:
                    yield os.path.join(dirpath, fn)


def convert(text):
    n = sum(text.count(k) for k in MOJIBAKE)
    for bad, good in MOJIBAKE.items():
        text = text.replace(bad, good)
    n += sum(1 for ch in text if ch in TABLE)
    return ''.join(TABLE.get(ch, ch) for ch in text), n


def outside_gb2312(text):
    """Han characters that GB2312 (simplified-only charset) cannot encode."""
    found = {}
    for ch in text:
        if not ('㐀' <= ch <= '鿿' or '豈' <= ch <= '﫿'):
            continue
        if ch in ALLOW_OUTSIDE_GB2312 or ch in found:
            continue
        try:
            ch.encode('gb2312')
        except UnicodeEncodeError:
            found[ch] = text.count(ch)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scan', action='store_true')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    total = 0
    files = 0
    unknown = 0
    for path in iter_files():
        with open(path, encoding='utf-8', newline='') as fh:
            text = fh.read()
        rel = os.path.relpath(path, ROOT)
        new, n = convert(text)
        if n:
            total += n
            files += 1
            print(f'{n:6d}  {rel}')
            if args.apply:
                with open(path, 'w', encoding='utf-8', newline='') as fh:
                    fh.write(new)
        # 独立于对照表的检测：转换后仍在 GB2312 之外的字（漏网繁体或乱码），需要人工确认后入表
        rest = outside_gb2312(new)
        if rest:
            unknown += sum(rest.values())
            print(f'  ??  {rel}: ' + ' '.join(f'{ch}×{c}' for ch, c in rest.items()))
    print(f'{total} characters in {files} files ({len(TABLE)} table entries, {len(MOJIBAKE)} mojibake fixes); '
          f'{unknown} unknown outside GB2312', file=sys.stderr)


if __name__ == '__main__':
    main()
