import re
import json
import csv
from zipfile import ZipFile
from zipfile import Path as ZipFilePath
from treelib import Tree
from pathlib import Path
from collections import deque, defaultdict


class LinuxPerfResults:
    def __init__(self, storage: str, identifier: str,
                 entity: str, node: str):
        self._entity_path = Path(storage) / identifier / 'system' / \
            entity
        self._path = self._entity_path / node / 'linuxperf'

        self._threads_metadata = None

        with (self._path / 'threads.json').open(mode='r') as f:
            self._threads_metadata = json.load(f)

        self._metrics = {}
        self._roofline_info = {}
        self._thread_tree = None

        for metric in filter(Path.is_dir, self._path.glob('*')):
            metric_path = metric / 'dirmeta.json'

            if not metric_path.exists():
                continue

            with metric_path.open(mode='r') as f:
                data = json.load(f)
                self._metrics[metric.name] = data
                self._metrics[metric.name]['flame_graph'] = True

                if len(self._roofline_info) == 0:
                    carm_match = re.search(r'^CARM_(\S+)_(\S+)$', data['title'])
                    if carm_match is not None:
                        cpu_type = carm_match.group(1)

                        if cpu_type == 'INTEL':
                            self._roofline_info = {
                                'cpu_type': 'Intel_x86',
                                'ai_keys': [
                                    'mem_inst_retired.any'
                                ],
                                'instr_keys': [
                                    'fp_arith_inst_retired.scalar_single',
                                    'fp_arith_inst_retired.scalar_double',
                                    'fp_arith_inst_retired.128b_packed_single',
                                    'fp_arith_inst_retired.128b_packed_double',
                                    'fp_arith_inst_retired.256b_packed_single',
                                    'fp_arith_inst_retired.256b_packed_double',
                                    'fp_arith_inst_retired.512b_packed_single',
                                    'fp_arith_inst_retired.512b_packed_double'
                                ]
                            }
                        elif cpu_type == 'AMD':
                            self._roofline_info = {
                                'cpu_type': 'AMD_x86',
                                'ai_keys': [
                                    'ls_dispatch:ld_dispatch',
                                    'ls_dispatch:store_dispatch'
                                ],
                                'instr_keys': [
                                    'retired_sse_avx_operations:sp_mult_add_flops',
                                    'retired_sse_avx_operations:dp_mult_add_flops',
                                    'retired_sse_avx_operations:sp_add_sub_flops',
                                    'retired_sse_avx_operations:dp_add_sub_flops',
                                    'retired_sse_avx_operations:sp_mult_flops',
                                    'retired_sse_avx_operations:dp_mult_flops',
                                    'retired_sse_avx_operations:sp_div_flops',
                                    'retired_sse_avx_operations:dp_div_flops'
                                ]
                            }

        self._general_metrics = {}

        if (self._path / 'roofline.csv').exists():
            self._general_metrics['roofline'] = {
                'title': 'Cache-aware roofline model'
            }

        self._sources = {}
        self._source_index = {}
        self._source_zip_path = None

        if (self._path / 'sources.json').exists():
            with (self._path / 'sources.json').open(
                    mode='r') as f:
                self._sources = json.load(f)

        if (self._entity_path / 'src.zip').exists():
            self._source_zip_path = self._entity_path / 'src.zip'

        if self._source_zip_path is not None:
            src_index_path = self._path / 'src_index.json'

            if src_index_path.exists():
                with src_index_path.open(mode='r') as f:
                    self._source_index = json.load(f)
            else:
                with ZipFile(self._source_zip_path) as zip:
                    path = ZipFilePath(zip, 'index.json')

                    if path.exists():
                        with path.open(mode='r') as f:
                            index_str = f.read()

                        self._source_index = json.loads(index_str)
                        with src_index_path.open(mode='w') as f:
                            f.write(index_str)

    def get_general_analysis(self, analysis_type):
        """
        Get general analysis data of a specified type. If the type
        does not exist, None is returned.

        :param str analysis_type: The type of a general analysis which
                                  data should be returned for, e.g.
                                  "roofline" for a cache-aware roofline
                                  model.
        """
        if analysis_type == 'roofline':
            p = self._path / 'roofline.csv'

            if not p.exists():
                return None

            data = {
                'type': analysis_type,
                'l1': None,
                'l2': None,
                'l3': None,
                'models': []
            }

            with p.open(mode='r', newline='') as f:
                reader = csv.reader(f)

                first_header = next(reader)

                if len(first_header) != 21 or \
                   [first_header[0], first_header[2],
                    first_header[4], first_header[6]] + \
                    first_header[9:] != \
                    ['Name:', 'L1 Size:', 'L2 Size:',
                     'L3 Size:', 'L1', 'L1', 'L2', 'L2',
                     'L3', 'L3', 'DRAM', 'DRAM',
                     'FP', 'FP', 'FP FMA', 'FP_FMA']:
                    return None

                second_header = next(reader)

                if second_header != \
                    ['Date', 'ISA', 'Precision', 'Threads',
                     'Loads', 'Stores', 'Interleaved', 'DRAM Bytes',
                     'FP Inst.', 'GB/s', 'I/Cycle', 'GB/s',
                     'I/Cycle', 'GB/s', 'I/Cycle', 'GB/s',
                     'I/Cycle', 'Gflop/s', 'I/Cycle', 'Gflop/s',
                     'I/Cycle']:
                    return None

                data['l1'] = int(first_header[3])
                data['l2'] = int(first_header[5])
                data['l3'] = int(first_header[7])

                for row in reader:
                    if row is None or len(row) != 21:
                        continue

                    data['models'].append({
                        'isa': row[1],
                        'precision': row[2],
                        'threads': row[3],
                        'loads': row[4],
                        'stores': row[5],
                        'interleaved': row[6],
                        'dram_bytes': row[7],
                        'fp_inst': row[8],
                        'l1': {
                            'gbps': row[9],
                            'instpc': row[10]
                        },
                        'l2': {
                            'gbps': row[11],
                            'instpc': row[12]
                        },
                        'l3': {
                            'gbps': row[13],
                            'instpc': row[14]
                        },
                        'dram': {
                            'gbps': row[15],
                            'instpc': row[16]
                        },
                        'fp': {
                            'gflops': row[17],
                            'instpc': row[18]
                        },
                        'fp_fma': {
                            'gflops': row[19],
                            'instpc': row[20]
                        }
                    })

            return data
        else:
            return None

    def get_flame_graph(self, pid, tid, compress_threshold):
        """
        Get a flame graph of the thread/process with a given PID and TID
        to be rendered by d3-flame-graph, taking into account to collapse
        blocks taking less than a specified share of total samples.

        :param int pid: The PID of a thread/process in the session.
        :param int tid: The TID of a thread/process in the session.
        :param float compress_threshold: A compression threshold. For
                                         example, if its value is 0.10,
                                         blocks taking less than 10% of
                                         total samples will be collapsed.
        """
        data = {}

        for p in self._path.glob(f'*/{pid}/{tid}'):
            data[p.parent.parent.name] = []

        # Untimed
        def recurse_untimed(node, path):
            with (path / 'dirmeta.json').open(mode='r') as f:
                metadata = json.load(f)

            node['name'] = path.name
            node['offsets'] = defaultdict(lambda: {
                'hot_value': 0,
                'cold_value': 0
            })

            for key in metadata.keys():
                if key in ['hot_value', 'cold_value']:
                    node[key] = metadata[key]
                elif key.startswith('hot_0x'):
                    offset = re.search(r'^hot_(.+)$', key).group(1)
                    node['offsets'][offset]['hot_value'] += metadata[key]
                elif key.startswith('cold_0x'):
                    offset = re.search(r'^cold_(.+)$', key).group(1)
                    node['offsets'][offset]['cold_value'] += metadata[key]

            node['value'] = node.get('hot_value', 0) + node.get('cold_value', 0)
            node['children'] = []
            for p in filter(Path.is_dir, path.glob('*')):
                child = {}
                node['children'].append(child)
                recurse_untimed(child, p)

        for metric in data.keys():
            start_path = self._path / metric / str(pid) / str(tid) / 'untimed' / 'all'
            graph = {}
            recurse_untimed(graph, start_path)
            data[metric].append(graph)

        # Timed
        def recurse_timed(node, path):
            meta_path = path.parent / f'meta_{path.stem}.json'
            with meta_path.open(mode='r') as f:
                metadata = json.load(f)

            node['offsets'] = defaultdict(lambda: {
                'hot_value': 0,
                'cold_value': 0
            })

            for k in metadata.keys():
                if k in ['name', 'hot_value', 'cold_value']:
                    node[k] = metadata[k]
                elif k.startswith('hot_0x'):
                    offset = re.search(r'^hot_(.+)$', k).group(1)
                    node['offsets'][offset]['hot_value'] += metadata[k]
                elif k.startswith('cold_0x'):
                    offset = re.search(r'^cold_(.+)$', k).group(1)
                    node['offsets'][offset]['cold_value'] += metadata[k]

            node['value'] = node.get('hot_value', 0) + node.get('cold_value', 0)
            node['children'] = []

            with path.open(mode='r') as f:
                for line in f:
                    line = line.strip()

                    if len(line) == 0:
                        continue

                    child = {}
                    node['children'].append(child)
                    recurse_timed(child, path.parent / f'{line}.dat')

        for metric in data.keys():
            start_path = self._path / metric / str(pid) / str(tid) / 'timed' / 'all.dat'
            graph = {}
            recurse_timed(graph, start_path)
            data[metric].append(graph)

        # Processing
        for k, v in data.items():
            if len(v) != 2:
                raise RuntimeError(f'{k} in {pid}_{tid}.json should have '
                                   f'exactly 2 elements, but it has {len(v)}')

            compressed_blocks_lists = [[], []]
            queue = deque([(v[0], v[0]['value'], False, False,
                            compressed_blocks_lists[0]),
                           (v[1], v[1]['value'], True, False,
                            compressed_blocks_lists[1])])

            while len(queue) > 0:
                result, total, time_ordered, parent_is_compressed, \
                    compressed_blocks = queue.pop()

                children = result['children']
                new_children = []
                compressed_value = 0
                hidden_children = []
                compressed_children = set()

                for i, child in enumerate(children):
                    if child['value'] < compress_threshold * total:
                        compressed_children.add(i)
                    else:
                        queue.append((child, total, time_ordered, False,
                                      compressed_blocks))

                for i, child in enumerate(children):
                    if time_ordered:
                        if i in compressed_children:
                            compressed_value += child['value']
                            hidden_children.append(child)
                        else:
                            if compressed_value > 0:
                                if compressed_value == total \
                                   and parent_is_compressed:
                                    new_children += hidden_children
                                else:
                                    new_child = {
                                        'name': '(compressed)',
                                        'value': compressed_value,
                                        'children': hidden_children,
                                        'compressed_id': len(compressed_blocks)
                                    }

                                    queue.append((new_child,
                                                  compressed_value,
                                                  time_ordered,
                                                  True,
                                                  compressed_blocks))

                                    compressed_blocks.append(new_child)
                                    new_children.append(new_child)

                                compressed_value = 0
                                hidden_children = []

                            new_children.append(child)
                    else:
                        if i in compressed_children:
                            compressed_value += child['value']
                            hidden_children.append(child)
                        else:
                            new_children.append(child)

                if compressed_value > 0:
                    if len(hidden_children) == 1 and \
                       len(hidden_children[0]['children']) == 0:
                        new_children += hidden_children
                    elif compressed_value == total and parent_is_compressed:
                        if len(hidden_children) > 1:
                            part1_cnt = len(hidden_children) // 2

                            compressed_value_part1 = 0
                            for i in range(part1_cnt):
                                compressed_value_part1 += \
                                    hidden_children[i]['value']

                            compressed_value_part2 = compressed_value - \
                                compressed_value_part1

                            new_child1 = {
                                'name': '(compressed)',
                                'value': compressed_value_part1,
                                'children': hidden_children[:part1_cnt],
                                'compressed_id': len(compressed_blocks)
                            }

                            new_child2 = {
                                'name': '(compressed)',
                                'value': compressed_value_part2,
                                'children': hidden_children[part1_cnt:],
                                'compressed_id': len(compressed_blocks) + 1
                            }

                            queue.append((new_child1, compressed_value_part1,
                                          time_ordered, True,
                                          compressed_blocks))
                            queue.append((new_child2, compressed_value_part2,
                                          time_ordered, True,
                                          compressed_blocks))

                            compressed_blocks.append(new_child1)
                            compressed_blocks.append(new_child2)

                            new_children.append(new_child1)
                            new_children.append(new_child2)
                        else:
                            new_children += hidden_children
                    else:
                        new_child = {
                            'name': '(compressed)',
                            'value': compressed_value,
                            'children': hidden_children,
                            'compressed_id': len(compressed_blocks)
                        }

                        queue.append((new_child, compressed_value,
                                      time_ordered, True,
                                      compressed_blocks))

                        compressed_blocks.append(new_child)
                        new_children.append(new_child)

                if 'compressed_id' in result:
                    result['children'] = []
                    result['hidden_children'] = new_children
                else:
                    result['children'] = new_children

            for compressed_blocks in compressed_blocks_lists:
                deleted_block_ids = set()
                for block in compressed_blocks:
                    if block['compressed_id'] in deleted_block_ids:
                        continue

                    while (len(block['hidden_children']) == 1 and
                           'hidden_children' in block['hidden_children'][0]):
                        deleted_block_ids.add(
                            block['hidden_children'][0]['compressed_id'])
                        block['hidden_children'] = \
                            block['hidden_children'][0]['hidden_children']

        return json.dumps(data)

    def get_callchain_mappings(self):
        """
        Get a JSON object string representing dictionaries mapping compressed
        callchain names to full symbol and library/executable names.

        Inside the object, the dictionaries are grouped by event types, e.g.
        "syscalls" has the mappings between compressed callchain names
        captured during tree profiling and full symbol and
        library/executable names.
        """
        result_dict = {}

        if (self._path / 'callchains.json').exists():
            with (self._path / 'callchains.json').open(mode='r') as f:
                result_dict['syscall'] = json.load(f)

        for k in self._metrics.keys():
            path = self._path / k / 'callchains.json'

            if not path.exists():
                continue

            with path.open(mode='r') as f:
                result_dict[k] = json.load(f)

        return json.dumps(result_dict)

    def get_thread_tree(self) -> Tree:
        """
        Get a treelib.Tree object representing the thread/process tree of
        the session.
        """
        if self._thread_tree is not None:
            return self._thread_tree

        tree = Tree()

        for n in self._threads_metadata['tree']:
            tree.create_node(**n)

        self._thread_tree = tree
        return tree

    def get_json_tree(self):
        """
        Get a JSON object string representing the thread/process tree of
        the session.

        The returned object is the root, which describes the very first
        process detected in the session along with its children.
        The object has the following keys:
        * "id": the unique identifier of a thread/process in form of
          "<PID>_<TID>".
        * "start_time": the timestamp of the moment when the thread/process
           was effectively started, in milliseconds.
        * "runtime": the number of milliseconds the thread/process was
          running for.
        * "sampled_time": the number of milliseconds the thread/process
          was running for, as sampled by "perf".
        * "name": the process name.
        * "pid_tid": the PID and TID pair string in form of "<PID>/<TID>".
        * "off_cpu": the list of intervals when the thread/process was
          off-CPU. Each interval is in form of (a, b), where a is the
          start time of an off-CPU interval and b is the length of such
          interval.
        * "start_callchain": the callchain spawning the thread/process.
        * "metrics": the JSON object mapping extra per-thread profiling metrics
          (in addition to on-CPU/off-CPU activity) to their website titles
          and their type (i.e. flame-graph-related or not flame-graph-related).
          An example object is {"page-faults": {"title": "Page faults",
          "flame_graph": true}}. The structure can also be empty.
        * "general_metrics": the JSON object mapping general profiling
          metrics to their website titles and other auxiliary data (e.g.
          {"roofline": {"title": "Roofline model", ...}). This is set
          only for the root and it can be empty.
        * "src": the JSON object mapping library/executable offsets to
          lines within source code files. This is set only for the root
          and it can be empty. The structure is as follows:
          {"<library/executable path>":
          {"<hex offset>": {"file": "<path>", "line": <number>}}}.
          Refer to "src_index" (which is also returned by get_json_tree())
          and use get_source_code() to obtain a source code corresponding to
          <path>.
        * "src_index": the JSON object mapping source code paths inside
          "src" to shortened filenames that should be provided to
          get_source_code(). This is set only for the root and it can be empty.
        * "children": the list of all threads/processes spawned by the
          thread/process. Each element has the same structure as the root
          except for "general_metrics" which is absent.
        * "roofline": the JSON object with information necessary for
          interpreting roofline profiling results. The structure is as follows:
          {"cpu_type": "<CPU type, e.g. Intel_x86>", "ai_keys": [<events for
          calculating arithmetic intensity>], "instr_keys": [<events for
          calculating FLOPS etc.>]}. This is set only for the root and
          it can be empty.
        """
        def to_ms(num):
            return None if num is None else num / 1000000

        tree = self.get_thread_tree()

        def node_to_dict(node, is_root):
            process_name, pid_tid, start_time, runtime = node.tag
            pid_tid_code = pid_tid.replace('/', '_')
            pid, tid = pid_tid.split('/')

            start_time = to_ms(start_time)
            if runtime != -1:
                runtime = to_ms(runtime)

            offcpu_path = self._path / 'walltime' / pid / tid / 'offcpu.dat'
            offcpu_regions = []

            if offcpu_path.exists():
                with offcpu_path.open(mode='r') as f:
                    for line in f:
                        line = line.strip()

                        if len(line) == 0:
                            continue

                        a, b = line.split(' ')
                        offcpu_regions.append((to_ms(int(a)),
                                               to_ms(int(b))))

            thread_specific_metadata_path = self._path / 'walltime' / pid / tid / 'dirmeta.json'

            if thread_specific_metadata_path.exists():
                with thread_specific_metadata_path.open(mode='r') as f:
                    thread_specific_metadata = json.load(f)
            else:
                thread_specific_metadata = {}

            total_sampled_time = \
                to_ms(thread_specific_metadata.get('sampled_period', None))

            if total_sampled_time is None:
                total_sampled_time = runtime

            to_return = {
                'id': pid_tid.replace('/', '_'),
                'start_time': start_time,
                'runtime': runtime,
                'sampled_time': total_sampled_time,
                'name': process_name,
                'pid_tid': pid_tid,
                'off_cpu': offcpu_regions,
                'start_callchain': self._threads_metadata[
                    'spawning_callchains'].get(
                    tid, []),
                'metrics': self._metrics,
                'children': []
            }

            if is_root:
                to_return['general_metrics'] = self._general_metrics
                to_return['src'] = self._sources
                to_return['src_index'] = self._source_index
                to_return['roofline'] = self._roofline_info

            children = tree.children(node.identifier)

            if len(children) > 0:
                for child in children:
                    to_return['children'].append(node_to_dict(child,
                                                              False))

            return to_return

        if tree.root is None:
            return json.dumps({})
        else:
            return json.dumps(node_to_dict(tree.get_node(tree.root),
                                           True))

    def get_source_code(self, filename):
        """
        Get a source code stored in the session under a specified
        name.

        :param str filename: The name of a source code to be
                             obtained. It must come from "src_index"
                             produced by get_thread_tree().
        """
        if self._source_zip_path is None:
            return None

        with ZipFile(self._source_zip_path) as zip:
            path = ZipFilePath(zip, filename)

            if not path.exists():
                return None

            with path.open() as f:
                return f.read()


def process(storage, identifier, entity, node, data):
    if 'thread_tree' in data or \
       'general_analysis' in data or \
       ('pid' in data and 'tid' in data and
        'threshold' in data) or \
       'callchain' in data or 'src' in data:
        results = LinuxPerfResults(storage, identifier,
                                   entity, node)

        if 'thread_tree' in data:
            return results.get_json_tree()
        elif 'general_analysis' in data:
            json_data = results.get_general_analysis(
                data['general_analysis'])

            if json_data is None:
                return '', 404
            else:
                return json_data
        elif 'pid' in data and 'tid' in data and \
             'threshold' in data:
            json_data = results.get_flame_graph(
                data['pid'],
                data['tid'],
                float(data['threshold']))

            if json_data is None:
                return '', 404
            else:
                return json_data
        elif 'callchain' in data:
            return results.get_callchain_mappings()
        elif 'src' in data:
            result = results.get_source_code(data['src'])

            if result is None:
                return '', 404

            return result
    else:
        return '', 400
