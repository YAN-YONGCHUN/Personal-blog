import { writeFile } from 'node:fs/promises';

const output = new URL('../assets/leetcode-catalog.json', import.meta.url);
const groups = [
  {
    id: 'hash',
    title: '哈希与计数',
    description: '用哈希表把查找、去重和频次统计降到近似常数时间。',
    ids: ['1', '36', '49', '128', '1346', '202', '205', '217', '219', '242', '290', '349', '350', '380', '387', '454', '560', '599', '705', '706']
  },
  {
    id: 'window',
    title: '滑动窗口与双指针',
    description: '维护连续区间或两端边界，适合字符串、子数组和有序数组。',
    ids: ['3', '11', '15', '18', '26', '27', '42', '76', '80', '88', '125', '167', '209', '283', '438', '567', '611', '713', '904', '1004']
  },
  {
    id: 'binary',
    title: '二分与排序',
    description: '在有序结构或单调答案空间里缩小边界，控制复杂度。',
    ids: ['4', '33', '34', '35', '69', '74', '81', '153', '154', '162', '275', '300', '378', '410', '475', '540', '658', '704', '852', '875']
  },
  {
    id: 'prefix',
    title: '前缀和与差分',
    description: '把区间累积信息预处理成可复用状态，快速回答大量子区间查询。',
    ids: ['1480', '303', '304', '307', '437', '523', '525', '528', '560', '724', '918', '930', '974', '1074', '1314', '1423', '1442', '1590', '1732', '1991']
  },
  {
    id: 'greedy',
    title: '区间与贪心',
    description: '先排序，再用局部最优选择维护覆盖、调度或资源分配。',
    ids: ['56', '57', '406', '435', '452', '455', '605', '621', '630', '646', '763', '767', '826', '870', '881', '948', '1005', '1029', '1353', '1710']
  },
  {
    id: 'graph',
    title: '图论与最短路',
    description: '从 BFS、Dijkstra 到状态图搜索，选择与边权和状态空间匹配的路径算法。',
    ids: ['127', '542', '752', '847', '882', '934', '994', '1091', '1334', '1514', '1631', '1786', '1971', '1976', '2045', '2203', '2290', '2577', '743', '787']
  }
];

const response = await fetch('https://leetcode.cn/api/problems/all/');
if (!response.ok) throw new Error(`LeetCode API returned ${response.status}`);
const payload = await response.json();
const pairs = Array.isArray(payload.stat_status_pairs) ? payload.stat_status_pairs : [];
const byNumber = new Map(pairs.map((item) => [String(item.stat.frontend_question_id), item]));
const missing = groups.flatMap((group) => group.ids.filter((id) => !byNumber.has(id)));
if (missing.length) throw new Error(`Missing LeetCode problems: ${missing.join(', ')}`);

const difficulty = { 1: '简单', 2: '中等', 3: '困难' };
const catalog = groups.flatMap((group) => group.ids.map((id, index) => {
  const item = byNumber.get(id);
  const accepted = Number(item.stat.total_acs) || 0;
  const submitted = Number(item.stat.total_submitted) || 0;
  return {
    knowledgePoint: group.id,
    knowledgePointTitle: group.title,
    knowledgePointDescription: group.description,
    order: index + 1,
    number: id,
    title: item.stat.question__title,
    slug: item.stat.question__title_slug,
    difficulty: difficulty[item.difficulty.level] || '未知',
    paidOnly: Boolean(item.paid_only),
    acceptanceRate: submitted ? Number((accepted / submitted * 100).toFixed(1)) : 0,
    url: `https://leetcode.cn/problems/${item.stat.question__title_slug}/`
  };
}));

await writeFile(output, `${JSON.stringify({ source: '力扣公开题库', generatedAt: new Date().toISOString().slice(0, 10), groups, problems: catalog }, null, 2)}\n`, 'utf8');
console.log(`Wrote ${catalog.length} problems across ${groups.length} knowledge points to ${output.pathname}`);
