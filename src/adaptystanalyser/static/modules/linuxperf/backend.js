const MODULE_NAME = 'linuxperf';

class TimelineWindow extends Window {
    getType() {
        return 'linuxperf_timeline';
    }

    getTitle() {
        return 'CPU timeline';
    }

    startResize() {

    }

    finishResize() {

    }

    prepareRefresh() {

    }

    prepareClose() {

    }

    getContentCode() {
        return `
<div class="toolbar">
    <div class="toolbar_texts">
      <div class="glossary">
        <b><font color="#aa0000">Red parts</font></b> are on-CPU and
        <b><font color="#0294e3">blue parts</font></b> are off-CPU. <b>Right-click</b>
        any thread/process to open the details menu.
      </div>
      <div class="off_cpu_sampling_warning">
        <b><font color="#ff0000">WARNING:</font></b> The current off-CPU timeline
        display scale is <span class="off_cpu_scale_value"></span>, which means that <b>the timeline does
        not show off-CPU periods missing the sampling period of <span class="off_cpu_sampling_period"></span> ms!</b> <b><u>No</u></b> other analyses are affected.
      </div>
      <div class="no_off_cpu_warning">
        <b><font color="#ff0000">WARNING:</font></b> The current off-CPU timeline
        display scale is 0, which means that <b>the timeline does
        not show any off-CPU periods!</b> <b><u>No</u></b> other analyses are affected.
      </div>
    </div>
    <div class="toolbar_buttons">
      <svg xmlns="http://www.w3.org/2000/svg" class="general_analyses" data-icon="general"
         height="24px"
         width="24px" fill="#000000"
         onclick="" class="disabled">
        <title>General analyses</title>
      </svg>
    </div>
</div>
<div class="window_space linuxperf_timeline"></div>
`;
    }

    _setup(data, existing_window) {
        if (!existing_window) {
            this.getData().offcpu_sampling = 0;
            this.getData().show_no_off_cpu_warning = false;
            this.getData().item_list = [];
            this.getData().group_list = [];
            this.getData().item_dict = {};
            this.getData().callchain_dict = {};
            this.getData().metrics_dict = {};
            this.getData().tooltip_dict = {};
            this.getData().warning_dict = {};
            this.getData().general_metrics_dict = {};
            this.getData().perf_maps_cache = {};
            this.getData().result_cache = {};
            this.getData().sampled_diff_dict = {};
            this.getData().src_dict = {};
            this.getData().src_index_dict = {};
            this.getData().overall_end_time = [0];
            this.getData().src_cache = {};
            this.getData().roofline_dict = {};
            this.getData().roofline_info = {};
        }

        let from_json_to_item = (json, level,
                                 item_list, group_list,
                                 item_dict, metrics_dict,
                                 callchain_dict, tooltip_dict,
                                 warning_dict, overall_end_time,
                                 general_metrics_dict,
                                 sampled_diff_dict,
                                 src_dict, src_index_dict,
                                 roofline_info,
                                 max_off_cpu_sampling) => {
            let item = {
                id: json.id,
                group: json.id,
                type: 'background',
                content: '',
                start: json.start_time,
                end: json.start_time + json.runtime,
                style: 'background-color:#aa0000; z-index:-1'
            };

            overall_end_time[0] = Math.max(overall_end_time[0],
                                           json.start_time + json.runtime);

            let sampled_diff = (1.0 * Math.abs(
                json.runtime - json.sampled_time)) / json.runtime;
            sampled_diff_dict[item.id] = sampled_diff;
            let warning =
                sampled_diff > 1.0 * parseFloat(
                    $('#runtime_diff_threshold_input').val()) / 100;

            let group = {
                id: json.id,
                content: json.name + ' (' + json.pid_tid + ')',
                style: 'padding-left: ' + (level * 25) + 'px;',
                showNested: false
            };

            let nestedGroups = [];

            for (let i = 0; i < json.children.length; i++) {
                nestedGroups.push(json.children[i].id);
            }

            if (nestedGroups.length > 0) {
                group.nestedGroups = nestedGroups;
            }

            item_list.push(item);
            group_list.push(group);

            let numf = new Intl.NumberFormat('en-US');

            json.runtime = json.runtime.toFixed(3);
            json.sampled_time = json.sampled_time.toFixed(3);

            let default_runtime;
            let default_sampled_time;
            let default_unit;

            if (json.runtime >= 1000 || json.sampled_time >= 1000) {
                default_runtime = (json.runtime / 1000).toFixed(3);
                default_sampled_time = (json.sampled_time / 1000).toFixed(3);
                default_unit = 's';
            } else {
                default_runtime = json.runtime;
                default_sampled_time = json.sampled_time;
                default_unit = 'ms';
            }

            item_dict[item.id] = json.name + ' (' + json.pid_tid + ')';
            tooltip_dict[item.id] =
                ['Runtime: ' +
                 numf.format(default_runtime) +
                 ' ' + default_unit + '<br /><span class="tooltip_sampled_runtime">' +
                 '(sampled: ~' +
                 numf.format(default_sampled_time) + ' ' + default_unit +
                 ')</span>',
                 'Runtime: ' +
                 numf.format(json.runtime) +
                 ' ms<br /><span class="tooltip_sampled_runtime">(sampled: ~' +
                 numf.format(json.sampled_time) + ' ms)</span>'];
            metrics_dict[item.id] = json.metrics;
            warning_dict[item.id] = [warning, sampled_diff];

            if ('general_metrics' in json && $.isEmptyObject(general_metrics_dict)) {
                Object.assign(general_metrics_dict, json.general_metrics);
            }

            if ('src' in json && $.isEmptyObject(src_dict)) {
                Object.assign(src_dict, json.src);
            }

            if ('src_index' in json && $.isEmptyObject(src_index_dict)) {
                Object.assign(src_index_dict, json.src_index);
            }

            if ('roofline' in json && $.isEmptyObject(roofline_info)) {
                Object.assign(roofline_info, json.roofline);
            }

            if (level > 0) {
                callchain_dict[item.id] = json.start_callchain;
            }

            let offcpu_sampling_raw = parseFloat($('#off_cpu_scale').val());

            if (offcpu_sampling_raw > 0) {
                if (offcpu_sampling_raw < 1) {
                    if (level === 0) {
                        max_off_cpu_sampling = json.runtime;
                    }

                    if (max_off_cpu_sampling !== undefined) {
                        this.getData().offcpu_sampling = Math.round(Math.pow(
                            1 - offcpu_sampling_raw, 3) * max_off_cpu_sampling);
                    }
                }

                for (let i = 0; i < json.off_cpu.length; i++) {
                    let start = json.off_cpu[i][0];
                    let end = start + json.off_cpu[i][1];

                    if (this.getData().offcpu_sampling === 0 ||
                        start % this.getData().offcpu_sampling === 0 ||
                        end % this.getData().offcpu_sampling === 0 ||
                        Math.floor(start / this.getData().offcpu_sampling) != Math.floor(
                            end / this.getData().offcpu_sampling)) {
                        let off_cpu_item = {
                            id: json.id + '_offcpu' + i,
                            group: json.id,
                            type: 'background',
                            content: '',
                            start: json.off_cpu[i][0],
                            end: json.off_cpu[i][0] + json.off_cpu[i][1],
                            style: 'background-color:#0294e3'
                        };

                        item_list.push(off_cpu_item);
                    }
                }
            } else {
                this.getData().show_no_off_cpu_warning = true;
            }

            for (let i = 0; i < json.children.length; i++) {
                from_json_to_item(json.children[i],
                                  level + 1,
                                  item_list,
                                  group_list,
                                  item_dict,
                                  metrics_dict,
                                  callchain_dict,
                                  tooltip_dict,
                                  warning_dict,
                                  overall_end_time,
                                  general_metrics_dict,
                                  sampled_diff_dict,
                                  src_dict,
                                  src_index_dict,
                                  roofline_info,
                                  max_off_cpu_sampling);
            }
        }

        let part2 = () => {
            if (!existing_window) {
                from_json_to_item(this._data, 0,
                                  this.getData().item_list,
                                  this.getData().group_list,
                                  this.getData().item_dict,
                                  this.getData().metrics_dict,
                                  this.getData().callchain_dict,
                                  this.getData().tooltip_dict,
                                  this.getData().warning_dict,
                                  this.getData().overall_end_time,
                                  this.getData().general_metrics_dict,
                                  this.getData().sampled_diff_dict,
                                  this.getData().src_dict,
                                  this.getData().src_index_dict,
                                  this.getData().roofline_info);
            }

            if ($.isEmptyObject(this.getData().general_metrics_dict)) {
                this.getContent().find('.general_analyses').off('click');
                this.getContent().find('.general_analyses').attr('class', 'disabled');
            } else {
                this.getContent().find('.general_analyses').on('click', (event) => {
                    this.onGeneralAnalysesClick(event);
                });
                this.getContent().find('.general_analyses').attr('class', 'pointer');
            }

            let container = this.getContent().find('.linuxperf_timeline');
            container.html('');

            if (this.getData().show_no_off_cpu_warning) {
                this.getContent().find('.no_off_cpu_warning').show();
            } else if (this.getData().offcpu_sampling > 0) {
                this.getContent().find('.off_cpu_sampling_period').text(this.getData().offcpu_sampling);
                this.getContent().find('.off_cpu_scale_value').text(
                    $('#off_cpu_scale').val());
                this.getContent().find('.off_cpu_sampling_warning').show();
            }

            this.getContent().find('.glossary').show();
            this.hideLoading();

            let timeline = new vis.Timeline(
                container[0],
                this.getData().item_list,
                this.getData().group_list,
                {
                    format: {
                        minorLabels: {
                            millisecond:'x [ms]',
                            second:     'X [s]',
                            minute:     'X [s]',
                            hour:       'X [s]',
                            weekday:    'X [s]',
                            day:        'X [s]',
                            week:       'X [s]',
                            month:      'X [s]',
                            year:       'X [s]'
                        }
                    },
                    showMajorLabels: false,
                    min: 0,
                    max: 2 * this.getData().overall_end_time[0]
                }
            );

            timeline.on('contextmenu', (props) => {
                if (props.group != null) {
                    let item_list = this.getData().item_list;
                    let group_list = this.getData().group_list;
                    let item_dict = this.getData().item_dict;
                    let callchain_dict = this.getData().callchain_dict;
                    let callchain_obj = this.callchain_obj;
                    let metrics_dict = this.getData().metrics_dict;
                    let tooltip_dict = this.getData().tooltip_dict;
                    let warning_dict = this.getData().warning_dict;
                    let general_metrics_dict = this.getData().general_metrics_dict;
                    let sampled_diff_dict = this.getData().sampled_diff_dict;
                    let src_dict = this.getData().src_dict;
                    let src_index_dict = this.getData().src_index_dict;

                    let items = [
                        {
                            item: $(`
<div class="header_item">
  <span class="runtime"></span>
        <svg xmlns="http://www.w3.org/2000/svg" class="runtime_warning" height="24px" data-icon="warning"
             width="24px" fill="#ff0000">
          <!-- The line below cannot be broken into multiple ones, so it must
               exceed ~80 characters -->
          <title>WARNING: The difference between the exact and sampled runtime is <span class="sampled_diff"></span>%, which exceeds <span class="runtime_diff_threshold">50</span>%!&#xA;&#xA;For accurate results, you may need to increase the on-CPU and/or off-CPU sampling frequency (depending on whether the process/thread runs mostly on- or off-CPU).</title>
        </svg>
</div>`)
                        }
                    ];

                    let last_item = {
                        item: $(`
<div class="callchain_item">
        Spawned by (hover/click to see code details):
        <div class="callchain"></div>
      </div>`)
                    };

                    let runtime_select = 0;

                    if ($('#always_ms').prop('checked')) {
                        runtime_select = 1;
                    }

                    items[0].item.find('.runtime').html(
                        tooltip_dict[props.group][runtime_select]);

                    let flame_graphs_present = false;

                    for (const [k, v] of Object.entries(metrics_dict[props.group])) {
                        if (v.flame_graph) {
                            if (!flame_graphs_present) {
                                flame_graphs_present = true;

                                items.push({
                                    item: $(`<div>Flame graphs</div>`),
                                    click_handler: [['flame_graphs',
                                                     props.group, this],
                                                    event => {
                                                        this.onMenuItemClick(event);
                                                    }],
                                    hover: true});
                            }
                        } else {
                            items.push({
                                item: $(`<div>${v.title}</div>`),
                                click_handler: [[k, props.group, this],
                                                event => {
                                                    this.onMenuItemClick(event);
                                                }],
                                hover: true});
                        }
                    }

                    if (sampled_diff_dict[props.group] >
                        1.0 * parseFloat($('#runtime_diff_threshold_input').val()) / 100) {
                        items[0].item.find('.tooltip_sampled_runtime').css('color', 'red');
                        items[0].item.find('.sampled_diff').html(
                            (sampled_diff_dict[props.group] * 100).toFixed(2));
                        items[0].item.find('.runtime_diff_threshold').html(
                            parseFloat($('#runtime_diff_threshold_input').val()));
                        items[0].item.find('.runtime_warning').show();
                    } else {
                        items[0].item.find('.tooltip_sampled_runtime').css('color', 'black');
                        items[0].item.find('.runtime_warning').hide();
                    }

                    if (props.group in callchain_dict) {
                        let callchain = last_item.item.find('.callchain');

                        let first = true;
                        for (const [name, offset] of callchain_dict[props.group]) {
                            let new_span = $('<span></span>');
                            new_span.css('cursor', 'help');

                            if (callchain_obj !== undefined &&
                                name in callchain_obj['syscall']) {
                                let symbol = callchain_obj['syscall'][name];
                                new_span.text(symbol[0]);

                                if (symbol[1] in src_dict &&
                                    offset in src_dict[symbol[1]]) {
                                    let src = src_dict[symbol[1]][offset];
                                    new_span.attr('title', src.file + ':' + src.line);

                                    if (src.file in src_index_dict) {
                                        new_span.css('color', 'green');
                                        new_span.css('font-weight', 'bold');
                                        new_span.css('text-decoration', 'underline');
                                        new_span.css('cursor', 'pointer');

                                        new_span.on(
                                            'click', {file: src.file,
                                                      filename: src_index_dict[src.file],
                                                      line: src.line},
                                            (event) => {
                                                let data = {};
                                                data[event.data.file] = {}
                                                data[event.data.file][
                                                    event.data.line] = 'exact';
                                                Menu.closeMenu();
                                                CodeWindow.openCode(this, data, event.data.file,
                                                                    this.getSession(), this.getEntityId(),
                                                                    this.getNodeId());
                                            });
                                    }
                                } else {
                                    new_span.attr('title', symbol[1] + '+' + offset);
                                }
                            } else {
                                new_span.text(name +
                                              ' (not-yet-loaded or missing ' +
                                              'callchain dictionary)');
                            }

                            if (first) {
                                first = false;
                            } else {
                                callchain.append('<br />');
                            }

                            callchain.append(new_span);
                        }

                        items.push(last_item);
                    }

                    Menu.createMenuWithCustomBlocks(props.pageX, props.pageY, items);

                    props.event.preventDefault();
                    props.event.stopPropagation();
                }
            });
        }

        $.ajax({
            url: this.getSession().id + '/' + this.getEntityId() + '/' + this.getNodeId() + '/' + MODULE_NAME,
            method: 'POST',
            dataType: 'json',
            data: {thread_tree: true}
        }).done(ajax_obj => {
            this._data = ajax_obj;
            $.ajax({
                url: this.getSession().id + '/' + this.getEntityId() + '/' + this.getNodeId() + '/' + MODULE_NAME,
                method: 'POST',
                dataType: 'json',
                data: {callchain: true}
            }).done(ajax_obj => {
                this.callchain_obj = ajax_obj;
                part2();
            }).fail(ajax_obj => {
                alert('Could not obtain the callchain mappings! You ' +
                      'will not get meaningful names when checking ' +
                      'any stack traces.');
                part2();
            });
        }).fail(ajax_obj => {
            alert('Could not download the node data!');
        });
    }

    onGeneralAnalysesClick(event) {
        Menu.closeMenu();

        let metrics_dict = this.getData().general_metrics_dict;

        let items = [
            {
                item: $(`
<div class="header_item">
        General analyses
       </div>`)
            }
        ];

        for (const [k, v] of Object.entries(metrics_dict)) {
            items.push({
                item: $(`<div>
             ${v.title}
           </div>`),
                click_handler: [k, (event) => {
                    this.onGeneralAnalysisMenuItemClick(event);
                }],
                hover: true});
        }

        Menu.createMenuWithCustomBlocks(event.pageX, event.pageY, items);

        event.preventDefault();
        event.stopPropagation();
    }

    onGeneralAnalysisMenuItemClick(event) {
        let analysis_type = event.data.data;

        if (analysis_type === 'roofline') {
            new RooflineWindow(this.getSession(), this.getEntityId(),
                               this.getNodeId(), MODULE_NAME, this,
                               event.pageX, event.pageY);
        }
    }

    onMenuItemClick(event) {
        let analysis_type = event.data.data[0];
        let timeline_group_id = event.data.data[1];
        let parent = event.data.data[2];

        if (analysis_type === 'flame_graphs') {
            new FlameGraphWindow(this.getSession(), this.getEntityId(),
                                 this.getNodeId(), MODULE_NAME, {
                                     root_window: this,
                                     timeline_group_id: timeline_group_id
                                 }, event.pageX, event.pageY);
        }
    }
}

class FlameGraphWindow extends Window {
    getType() {
        return 'linuxperf_flame_graph';
    }

    getContentCode() {
        return `
<div class="toolbar">
<div class="horizontal_flex">
<span class="collapse_info">
  Some blocks may be collapsed to speed up rendering, but you can expand
  them by clicking them.
</span>
<div class="vertical_flex">
<div class="flamegraph_choice">
  <div class="flamegraph_metric_choice">
    <select name="metric" class="flamegraph_metric">
      <option value="" disabled="disabled">
        Metric...
      </option>
    </select>
    <input type="checkbox" class="flamegraph_time_ordered" />
    <label class="flamegraph_time_ordered_label">Time-ordered</label>
  </div>
  <div class="flamegraph_remainder">
    <input type="text" class="flamegraph_search"
           placeholder="Search..." />
    <svg xmlns="http://www.w3.org/2000/svg" class="pointer flamegraph_replace" data-icon="replace"
         height="24px"
         width="24px" fill="#000000">
      <title>Replace (right-click to see the existing replacements)</title>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" class="pointer flamegraph_download" height="24px" data-icon="download"
         width="24px" fill="#000000">
      <title>Download the current flame graph view as SVG</title>
    </svg>
  </div>
</div>
</div>
<div class="flamegraph_search_results">
  <b>Search results:</b> <span class="flamegraph_search_blocks"></span> block(s) accounting for
  <span class="flamegraph_search_found"></span> unit(s) out of
  <span class="flamegraph_search_total"></span> (<span class="flamegraph_search_percentage"></span>%)
</div>
</div>
</div>
<div class="window_space flamegraph scrollable">
  <p class="no_flamegraph">
    There is no flame graph associated with the selected process/thread,
    metric, and time order (or the flame graph could not be loaded)!
    This may be caused by the inability of capturing a specific event
    for that process/thread (it is a disadvantage of sampling-based
    profiling).
  </p>
  <div class="flamegraph_svg"></div>
</div>
`;
    }

    startResize() {
        if (this.getData().flamegraph_obj !== undefined) {
            return true;
        }

        return false;
    }

    finishResize() {
        let flamegraph_obj = this.getData().flamegraph_obj;
        flamegraph_obj.width(this.getContent().find('.flamegraph_svg').outerWidth());
        flamegraph_obj.update();
    }

    prepareRefresh(data) {
        data.metric = this.getContent().find('.flamegraph_metric').val();
        data.time_ordered = this.getContent().find('.flamegraph_time_ordered').prop('checked');
    }

    getTitle() {
        return 'Flame graphs';
        //return 'Flame graphs for ' +
        //    session.item_dict[data.timeline_group_id];
    }

    prepareClose() {

    }

    _setup(data, existing_window) {
        this.root_window = data.root_window;
        this.getContent().find('.flamegraph_time_ordered').attr(
            'id', this.getId() + '_time_ordered');
        this.getContent().find('.flamegraph_time_ordered_label').attr(
            'for', this.getContent().find('.flamegraph_time_ordered').attr('id'));
        this.getContent().find('.flamegraph_search').on('input', () => {
            this.onSearchQueryChange(this.getContent().find('.flamegraph_search').val());
        });
        this.getContent().find('.flamegraph_time_ordered').on('change', (event) => {
            this.onTimeOrderedChange(event);
        });
        this.getContent().find('.flamegraph_metric').on('change', (event) => {
            this.onMetricChange(event);
        });
        this.getContent().find('.flamegraph_download').on('click', () => {
            this.downloadFlameGraph();
        });
        this.getContent().find('.flamegraph_replace').on('click', () => {
            this.onFlameGraphReplaceClick();
        });
        this.getContent().find('.flamegraph_replace').on('contextmenu', (event) => {
            this.onFlameGraphReplaceRightClick(event);
        });

        let to_remove = [];
        this.getContent().find('.flamegraph_metric > option').each(() => {
            if (!this.disabled) {
                to_remove.push($(this));
            }
        });

        for (const opt of to_remove) {
            opt.remove();
        }

        this.getData().metrics_dict = this.root_window.getData().metrics_dict[data.timeline_group_id];
        let show_carm_checked = $('#show_carm').prop('checked');
        let target_metric_present = false;
        for (const [k, v] of Object.entries(this.getData().metrics_dict)) {
            if (show_carm_checked ||
                !v.title.startsWith('CARM_')) {
                this.getContent().find('.flamegraph_metric').append(
                    new Option(v.title, k));

                if (k === data.metric) {
                    target_metric_present = true;
                }
            }
        }

        let metric = target_metric_present ? data.metric : 'walltime';
        this.getContent().find('.flamegraph_metric').val(metric);
        this.getContent().find('.flamegraph_time_ordered').prop(
            'checked', data.time_ordered === undefined ? false : data.time_ordered);
        this.getContent().find('.flamegraph').attr('data-id', data.timeline_group_id);

        this.getData().replacements = {};

        if (data.timeline_group_id + '_' +
            parseFloat($('#threshold_input').val()) in this.root_window.getData().result_cache) {
            this.getData().result_obj = this.root_window.getData().result_cache[
                data.timeline_group_id + '_' + parseFloat($(
                    '#threshold_input').val())];

            if (!(metric in this.getData().result_obj)) {
                this.getData().flamegraph_obj = undefined;
                this.getContent().find('.flamegraph_svg').hide();
                this.getContent().find('.flamegraph_search').val('');
                this.getContent().find('.no_flamegraph').show();
            } else {
                this.openFlameGraph(metric);
            }

            this.hideLoading();
        } else {
            let pid_tid = data.timeline_group_id.split('_');

            $.ajax({
                url: this.getSession().id + '/' + this.getEntityId() + '/' + this.getNodeId() + '/' + MODULE_NAME,
                method: 'POST',
                dataType: 'json',
                data: {pid: pid_tid[0], tid: pid_tid[1],
                       threshold: 1.0 * parseFloat($(
                           '#threshold_input').val()) / 100}
            }).done(ajax_obj => {
                this.root_window.getData().result_cache[
                    data.timeline_group_id + '_' + parseFloat($(
                        '#threshold_input').val())] = ajax_obj;
                this.getData().result_obj = ajax_obj;

                if (!(metric in this.getData().result_obj)) {
                    this.getData().flamegraph_obj = undefined;
                    this.getContent().find('.flamegraph_svg').hide();
                    this.getContent().find('.flamegraph_search').val('');
                    this.getContent().find('.no_flamegraph').show();
                } else {
                    this.openFlameGraph(metric);
                }

                this.hideLoading();
            }).fail(ajax_obj => {
                this.getData().flamegraph_obj = undefined;
                this.getContent().find('.flamegraph_svg').hide();
                this.getContent().find('.flamegraph_search').val('');
                this.getContent().find('.no_flamegraph').show();
                this.hideLoading();
            });
        }
    }

    updateFlameGraph(data, always_change_height) {
        let flamegraph_obj = this.getData().flamegraph_obj;
        if (flamegraph_obj !== undefined) {
            let update_height = () => {
                let flamegraph_svg = this.getContent().find('.flamegraph_svg').children()[0];

                if (flamegraph_svg !== undefined) {
                    let target_height = flamegraph_svg.getBBox().height;

                    if (always_change_height || target_height > this.getContent().find('.flamegraph_svg').outerHeight()) {
                        this.getContent().find('.flamegraph_svg').height(target_height);
                        flamegraph_svg.setAttribute('height', target_height);
                    }
                }
            };

            if (data !== null) {
                flamegraph_obj.update(data, update_height);
            } else {
                update_height();
            }
        }
    }

    onOpenCodeClick(event) {
        let data = event.data.data;
        let node = data.node;
        let offset_dict = data.offset_dict;
        let metric = data.metric;
        let sums = {};

        for (const [addr, val] of Object.entries(node.data.offsets)) {
            let decoded = offset_dict[addr];

            if (decoded === undefined) {
                continue;
            }

            if (!(decoded.file in sums)) {
                sums[decoded['file']] = {};
            }

            let val_sum = val.cold_value + val.hot_value;

            if (!(decoded.line in sums[decoded.file])) {
                if (metric === 'walltime') {
                    let scale = chroma.scale(['#ff3300', '#0099ff']);
                    let colour = scale((1.0 * val.cold_value) / (1.0 * val_sum)).rgb();
                    sums[decoded.file][decoded.line] = ['walltime',
                                                        colour[0],
                                                        colour[1],
                                                        colour[2],
                                                        0, 0, 0,
                                                        this.getData().metrics_dict[metric].unit];
                } else {
                    sums[decoded.file][decoded.line] = [metric, 0, 255, 0, 0, 0,
                                                        this.getData().metrics_dict[metric].unit];
                }
            }

            sums[decoded.file][decoded.line][4] += (val_sum / node.data.value);
            sums[decoded.file][decoded.line][5] += val.hot_value;

            if (metric === 'walltime') {
                sums[decoded.file][decoded.line][6] += val.cold_value;
            }
        }

        CodeWindow.openCode(this.root_window,
                            sums, Object.keys(sums)[0], this.getSession(), this.getEntityId(),
                            this.getNodeId());
    }

    onAddToRooflineClick(event) {
        let info = this.root_window.getData().roofline_info;
        let result_obj = this.getData().result_obj;
        let exists = false;
        let name = "";

        do {
            name = window.prompt((exists ? 'This name already exists!\n\n' : '') +
                                 'What name do you want to give to your new roofline point?');

            if (name == undefined || name === "") {
                return;
            }

            exists = name in this.root_window.getData().roofline_dict;
        } while (exists);

        let trace = [];
        let node = event.data.data.node;
        let cur_callchain_obj = this.root_window.callchain_obj[this.getContent().find('.flamegraph_metric').val()];

        while (node != undefined) {
            if (node.data.name in cur_callchain_obj) {
                trace.push(cur_callchain_obj[node.data.name]);
            } else {
                trace.push(node.data.name);
            }
            node = node.parent;
        }

        let ai_keys = info.ai_keys;
        let instr_keys = info.instr_keys;

        let ai_nodes = [];
        let instr_nodes = [];

        for (const k of ai_keys) {
            if (result_obj[k] === undefined) {
                ai_nodes.push([undefined]);
            } else {
                ai_nodes.push([result_obj[k][0],
                               this.root_window.callchain_obj[k]]);
            }
        }

        for (const k of instr_keys) {
            if (result_obj[k] === undefined) {
                instr_nodes.push([undefined]);
            } else {
                instr_nodes.push([result_obj[k][0],
                                  this.root_window.callchain_obj[k]]);
            }
        }

        let walltime_node = [[result_obj['walltime'][0],
                              this.root_window.callchain_obj['walltime']]];

        let iterate = (arr, req_name) => {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i][0] === undefined) {
                    continue;
                }

                let found = false;
                for (const child of arr[i][0].children) {
                    if ((typeof arr[i][1][child.name]) !== (typeof req_name)) {
                        continue;
                    }

                    if (((typeof req_name) === 'string' && arr[i][1][child.name] === req_name) ||
                        ((typeof req_name) === 'object' && arr[i][1][child.name].length === 2 &&
                         req_name.length === 2 && arr[i][1][child.name][0] === req_name[0] &&
                         arr[i][1][child.name][1] === req_name[1])) {
                        arr[i][0] = child;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    arr[i][0] = undefined;
                }
            }
        };

        for (let i = trace.length - 2; i >= 0; i--) {
            iterate(ai_nodes, trace[i]);
            iterate(instr_nodes, trace[i]);
            iterate(walltime_node, trace[i]);
        }

        let zeroed_instr_nodes = 0;
        let zeroed_ai_nodes = 0;

        for (let i = 0; i < instr_nodes.length; i++) {
            if (instr_nodes[i][0] === undefined) {
                instr_nodes[i] = 0;
                zeroed_instr_nodes++;
            } else {
                instr_nodes[i] = instr_nodes[i][0].value;
            }
        }

        for (let i = 0; i < ai_nodes.length; i++) {
            if (ai_nodes[i][0] === undefined) {
                ai_nodes[i] = 0;
                zeroed_ai_nodes++;
            } else {
                ai_nodes[i] = ai_nodes[i][0].value;
            }
        }


        if (walltime_node[0][0] === undefined ||
            zeroed_ai_nodes === ai_nodes.length ||
            zeroed_instr_nodes === instr_nodes.length) {
            window.alert('There is insufficient roofline information ' +
                         'for the requested code block!');
            return;
        }

        let flop = undefined;
        let flops = undefined;
        let arith_intensity = undefined;

        if (info.cpu_type === 'Intel_x86') {
            flop = instr_nodes[0] + instr_nodes[1] + 4 * instr_nodes[2] +
                2 * instr_nodes[3] + 8 * instr_nodes[4] + 4 * instr_nodes[5] +
                16 * instr_nodes[6] + 8 * instr_nodes[7];
            flops = flop / (walltime_node[0][0].value / 1000000000);

            let instr_sum = instr_nodes[0] + instr_nodes[1] + instr_nodes[2] +
                instr_nodes[3] + instr_nodes[4] + instr_nodes[5] + instr_nodes[6] +
                instr_nodes[7];

            let single_ratio =
                (instr_nodes[0] + instr_nodes[2] +
                 instr_nodes[4] + instr_nodes[6]) / instr_sum;
            let double_ratio =
                (instr_nodes[1] + instr_nodes[3] +
                 instr_nodes[5] + instr_nodes[7]) / instr_sum;
            arith_intensity = flop / (ai_nodes[0] * (4 * single_ratio +
                                                     8 * double_ratio));

            // let single_scalar_ratio = instr_nodes[0] / instr_sum;
            // let double_scalar_ratio = instr_nodes[1] / instr_sum;
            // let sse_ratio = (instr_nodes[2] + instr_nodes[3]) / instr_sum;
            // let avx2_ratio = (instr_nodes[4] + instr_nodes[5]) / instr_sum;
            // let avx512_ratio = (instr_nodes[6] + instr_nodes[7]) / instr_sum;

            // arith_intensity = flop / (ai_nodes[0] * (
            //     4 * single_scalar_ratio + 8 * double_scalar_ratio +
            //         16 * sse_ratio + 32 * avx2_ratio + 64 * avx512_ratio))
        } else if (info.cpu_type === 'AMD_x86') {
            flop = instr_nodes[0] + instr_nodes[1] + instr_nodes[2] +
                instr_nodes[3] + instr_nodes[4] + instr_nodes[5] +
                instr_nodes[6] + instr_nodes[7];
            flops = flop / (walltime_node[0][0].value / 1000000000);

            let single_ratio =
                (instr_nodes[0] + instr_nodes[2] +
                 instr_nodes[4] + instr_nodes[6]) / instr_sum;
            let double_ratio =
                (instr_nodes[1] + instr_nodes[3] +
                 instr_nodes[5] + instr_nodes[7]) / instr_sum;
            arith_intensity = flop / ((ai_nodes[0] + ai_nodes[1]) *
                                      (4 * single_ratio +
                                       8 * double_ratio));
        }

        this.root_window.getData().roofline_dict[name] = [arith_intensity, flops];

        for (const v of Object.values(Window.instances)) {
            if (v.getType() === 'linuxperf_roofline' &&
                v.session.id === this.getSession().id &&
                v.entity_id === this.getEntityId() &&
                v.node_id === this.getNodeId()) {
                v.dom.find('.roofline_point_select').append(
                    new Option(name, name));
                v.updateRoofline();
            }
        }
    }

    openFlameGraph(metric) {
        let result_obj = this.getData().result_obj;
        this.getData().flamegraph_obj = flamegraph();
        let flamegraph_obj = this.getData().flamegraph_obj;
        flamegraph_obj.inverted(true);
        flamegraph_obj.sort(this.getContent().find('.flamegraph_time_ordered').prop('checked') ? false : true);
        flamegraph_obj.color((node, original_color) => {
            if (node.highlight) {
                return original_color;
            } else if (node.data.name === "(compressed)") {
                return '#cc99ff';
            } else if (metric === 'walltime') {
                if (node.data.hot_value === node.data.value) {
                    return '#ff3300';
                } else {
                    let scale = chroma.scale(['#ff3300', '#0099ff']);
                    return scale((1.0 * node.data.cold_value) / (1.0 * node.data.value)).hex();
                }
            } else {
                return original_color;
            }
        });
        flamegraph_obj.getName(node => {
            let result = undefined;
            if (node.data.name in this.root_window.callchain_obj[this.getContent().find('.flamegraph_metric').val()]) {
                let symbol = this.root_window.callchain_obj[this.getContent().find('.flamegraph_metric').val()][node.data.name];
                result = new String(symbol[0]);
            } else {
                result = new String(node.data.name);
            }

            for (const [k, v] of Object.entries(
                this.getData().replacements)) {
                result = result.replace(new RegExp(k), v);
            }

            return result;
        });
        flamegraph_obj.onClick((node) => {
            if ("hidden_children" in node.data) {
                let parent = node.parent.data;
                let new_children = [];

                for (let i = 0; i < parent.children.length; i++) {
                    if ("compressed_id" in parent.children[i] &&
                        parent.children[i].compressed_id === node.data.compressed_id) {
                        for (let j = 0; j < node.data.hidden_children.length; j++) {
                            new_children.push(node.data.hidden_children[j]);
                        }
                    } else {
                        new_children.push(parent.children[i]);
                    }
                }

                parent.children = new_children;
                this.updateFlameGraph(d3.select('#' + this.getContent().find('.flamegraph_svg').attr('id')).datum().data, false);
            }
        });
        flamegraph_obj.onContextMenu((event, node) => {
            Menu.closeMenu();

            let options = [];

            if (!this.getContent().find('.flamegraph_time_ordered').prop('checked') &&
                'roofline' in this.root_window.getData().general_metrics_dict) {
                options.push(['Add to the roofline plot', [{
                    'node': node,
                    'window': this
                }, (event) => {
                    this.onAddToRooflineClick(event);
                }]]);
            }

            let symbol = this.root_window.callchain_obj[this.getContent().find('.flamegraph_metric').val()][node.data.name];

            if (symbol !== undefined && this.root_window.getData().src_dict[symbol[1]] !== undefined) {
                let offset_dict = this.root_window.getData().src_dict[symbol[1]];
                let code_available = false;

                for (const addr of Object.keys(node.data.offsets)) {
                    let decoded = offset_dict[addr];

                    if (decoded !== undefined) {
                        code_available = true;
                        break;
                    }
                }

                if (code_available) {
                    options.push(['View the code details', [{
                        'offset_dict': offset_dict,
                        'node': node,
                        'session': this.getSession(),
                        'metric': metric
                    }, (event) => {
                        this.onOpenCodeClick(event);
                    }]]);
                }
            }

            if (options.length === 0) {
                return;
            }

            Menu.createMenu(event.pageX, event.pageY, options);
        });
        flamegraph_obj.setLabelHandler((node) => {
            let numf = new Intl.NumberFormat('en-US');
            let name = this.getData().flamegraph_obj.getName()(node).valueOf();

            if (metric === 'walltime' && name !== '(compressed)') {
                if (node.data.hot_value === node.data.value) {
                    return name + ': ' + (100 * (node.x1 - node.x0)).toFixed(2) + '% of the entire execution time, ' + numf.format(node.data.value) + ' ' +
                        this.getData().metrics_dict[metric].unit + '\n\nOn-CPU: 100.00% of the block, ' +
                        numf.format(node.data.value) +
                        ' ' + this.getData().metrics_dict[metric].unit;
                } else if (node.data.cold_value === node.data.value) {
                    return name + ': ' + (100 * (node.x1 - node.x0)).toFixed(2) + '% of the entire execution time, ' + numf.format(node.data.value) + ' ' +
                        this.getData().metrics_dict[metric].unit + '\n\nOff-CPU: 100.00% of the block, ' +
                        numf.format(node.data.value) +
                        ' ' + this.getData().metrics_dict[metric].unit;
                } else {
                    return name + ': ' + (100 * (node.x1 - node.x0)).toFixed(2) + '% of the entire execution time, ' + numf.format(node.data.value) + ' ' +
                        this.getData().metrics_dict[metric].unit + '\n\nOn-CPU: ' +
                        (100 * ((1.0 * node.data.hot_value) /
                                (1.0 * node.data.value))).toFixed(2) + '% of the block, ' +
                        numf.format(node.data.hot_value) +
                        ' ' + this.getData().metrics_dict[metric].unit + '\nOff-CPU: ' +
                        (100 * ((1.0 * node.data.cold_value) /
                                (1.0 * node.data.value))).toFixed(2) + '% of the block, ' +
                        numf.format(node.data.cold_value) + ' ' +
                        this.getData().metrics_dict[metric].unit;
                }
            } else {
                if (name === '(compressed)') {
                    return 'This block is compressed, click it to expand it.\n\n' +
                    (100 * (node.x1 - node.x0)).toFixed(2) + '% overall, ' +
                    numf.format(node.data.value) +
                        ' ' + this.getData().metrics_dict[metric].unit;
                } else {
                    return name + ': ' +
                    (100 * (node.x1 - node.x0)).toFixed(2) + '% overall, ' +
                    numf.format(node.data.value) +
                        ' ' + this.getData().metrics_dict[metric].unit;
                }
            }
        });
        flamegraph_obj.setSearchHandler((results, sum, total) => {
            this.getContent().find('.flamegraph_search_blocks').html(results.length.toLocaleString());
            this.getContent().find('.flamegraph_search_found').html(sum.toLocaleString());
            this.getContent().find('.flamegraph_search_total').html(this.getData().total.toLocaleString());
            this.getContent().find('.flamegraph_search_percentage').html(
                (1.0 * sum / this.getData().total * 100).toFixed(2));
        });

        if (metric !== 'walltime') {
            flamegraph_obj.setColorHue('green');
        }

        this.getContent().find('.no_flamegraph').hide();
        this.getContent().find('.flamegraph_svg').html('');
        this.getContent().find('.flamegraph_search').val('');
        this.getContent().find('.flamegraph_search_results').hide();
        this.getContent().find('.flamegraph_svg').attr(
            'id', this.getId() + '_flamegraph_svg');
        this.getContent().find('.flamegraph_svg').show();
        flamegraph_obj.width(this.getContent().find('.flamegraph').outerWidth());
        d3.select('#' + this.getContent().find('.flamegraph_svg').attr('id')).datum(structuredClone(
            result_obj[metric][
                this.getContent().find('.flamegraph_time_ordered').prop('checked') ? 1 : 0])).call(
                    flamegraph_obj);
        this.getData().total =
            d3.select('#' + this.getContent().find('.flamegraph_svg').attr('id')).datum().data['value'];
        this.updateFlameGraph(null, true);
        flamegraph_obj.width(this.getContent().find('.flamegraph_svg').outerWidth());
        flamegraph_obj.update();

        this.getContent().find('.flamegraph')[0].scrollTop = 0;
    }

    onFlameGraphReplaceClick() {
        let query = window.prompt(
            'Please enter a regular expression to be replaced in ' +
                'the flame graph.',
            this.getContent().find('.flamegraph_search').val());

        if (query == undefined || query === "") {
            return;
        }

        let replacement = window.prompt(
            'Please enter what you want to replace your query with. ' +
                'You can use the syntax from https://developer.mozilla.org/' +
                'en-US/docs/Web/JavaScript/Reference/Global_Objects/String/' +
                'replace#specifying_a_string_as_the_replacement.');

        if (replacement == undefined) {
            return;
        }

        this.getData().replacements[query] = replacement;
        this.getData().flamegraph_obj.update();
    }

    onFlameGraphReplaceRightClick(event) {
        stopPropagation(event);

        let options = [];

        for (const [k, v] of Object.entries(
            this.getData().replacements)) {
            options.push([k + ' ==> ' + v, [{'query': k, 'replacement': v},
                                            (info) => {
                                                this.onReplacementClick(info);
                                            }]]);
        }

        if (options.length === 0) {
            return;
        }

        Menu.createMenu(event.pageX, event.pageY, options);
    }

    onReplacementClick(info) {
        let data = info.data.data;

        let replacements = this.getData().replacements;

        let query = window.prompt(
            'Please enter a regular expression to be replaced in ' +
                'the flame graph. To remove the replacement, put ' +
                'an empty text here.', data.query);

        if (query == undefined) {
            return;
        }

        if (query === "") {
            delete replacements[data.query];
            window.alert('The replacement has been removed!');
            this.getData().flamegraph_obj.update();
            return;
        }

        let replacement = window.prompt(
            'Please enter what you want to replace your query with. ' +
                'You can use the syntax from https://developer.mozilla.org/' +
                'en-US/docs/Web/JavaScript/Reference/Global_Objects/String/' +
                'replace#specifying_a_string_as_the_replacement.',
            data.replacement);

        if (replacement == undefined) {
            return;
        }

        this.getData().replacements[query] = replacement;
        this.getData().flamegraph_obj.update();
    }

    onMetricChange(event) {
        let result_obj = this.getData().result_obj;
        let metric = event.currentTarget.value;

        this.getData().flamegraph_obj = undefined;
        this.getContent().find('.flamegraph_time_ordered').prop('checked', false);

        if (metric in result_obj) {
            this.openFlameGraph(metric);
        } else {
            this.getContent().find('.flamegraph_search').val('');
            this.getContent().find('.flamegraph_search_results').hide();
            this.getContent().find('.flamegraph_svg').hide();
            this.getContent().find('.no_flamegraph').show();
        }
    }

    onTimeOrderedChange(event) {
        let flamegraph_obj = this.getData().flamegraph_obj;
        let result_obj = this.getData().result_obj;
        if (flamegraph_obj !== undefined) {
            flamegraph_obj.sort(!event.currentTarget.checked);
            this.updateFlameGraph(structuredClone(
                result_obj[this.getContent().find('.flamegraph_metric').val()][
                    event.currentTarget.checked ? 1 : 0]), true);

            this.getContent().find('.flamegraph_search').val('');
            this.getContent().find('.flamegraph_search_results').hide();
        }
    }

    onSearchQueryChange(value) {
        let flamegraph_obj = this.getData().flamegraph_obj;
        if (flamegraph_obj !== undefined) {
            if (value === undefined || value === "") {
                this.getContent().find('.flamegraph_search_results').hide();
            } else {
                this.getContent().find('.flamegraph_search_results').show();
            }

            flamegraph_obj.search(value);
        }
    }

    downloadFlameGraph() {
        if (this.getData().flamegraph_obj === undefined) {
            return;
        }

        this.downloadSvg('flamegraph_svg',
                         '/static/d3-flamegraph.css');
    }
}

class RooflineWindow extends Window {
    getType() {
        return 'linuxperf_roofline';
    }

    getContentCode() {
        return `
<div class="window_space roofline_box">
  <div class="roofline_settings">
    <fieldset class="roofline_type">
      <legend>Type</legend>
      <select name="roofline_type" class="roofline_type_select">
        <option value="" selected="selected" disabled="disabled">
          Select...
        </option>
      </select>
    </fieldset>
    <fieldset class="roofline_bounds">
      <legend>Bounds</legend>
      <div class="roofline_l1">
        <b>L1:</b> on
      </div>
      <div class="roofline_l2">
        <b>L2:</b> on
      </div>
      <div class="roofline_l3">
        <b>L3:</b> on
      </div>
      <div class="roofline_dram">
        <b>DRAM:</b> on
      </div>
      <div class="roofline_fp" title="There are two performance ceilings: FP_FMA (floating-point ops with FMA instructions) and FP (floating-point ops without FMA instructions). FP_FMA is used for plotting L1/L2/L3/DRAM bounds, but the lower FP ceiling can be plotted as an extra dashed black line since not all programs use FMA.">
        <b>FP:</b> on
      </div>
    </fieldset>
    <fieldset class="roofline_points">
      <legend>Code points</legend>
      <div class="roofline_point_select_div">
        <select name="roofline_point" class="roofline_point_select">
          <option value="" selected="selected" disabled="disabled">
            Select...
          </option>
        </select>
        <svg xmlns="http://www.w3.org/2000/svg" class="roofline_point_delete" data-icon="delete"
             height="24px" width="24px" fill="#000000">
           <title>Delete point</title>
        </svg>
      </div>
      <div class="roofline_point_details">
        <b>A: </b><span class="roofline_point_ai"><i>Select first.</i></span><br />
        <b>P: </b><span class="roofline_point_perf"><i>Select first.</i></span>
      </div>
    </fieldset>
    <fieldset class="roofline_details">
      <legend>Details</legend>
      <div class="roofline_details_text">
        <i>Please select a roofline type first.</i>
      </div>
      <div>
        <i>The x-axis is A: arithmetic intensity (flop per byte). The y-axis is P: performance (Gflop per second).</i>
      </div>
    </fieldset>
  </div>
  <div class="roofline">

  </div>
</div>
`;
    }

    startResize() {
        this.getContent().find('.roofline').html('');
        return true;
    }

    finishResize() {
        if (this.getData().roofline.plot_config !== undefined &&
            this.getContent().find('.roofline_type_select').val() != null) {
            this.getContent().find('.roofline').html('');

            let plot_config = this.getData().roofline.plot_config;
            plot_config.width = this.getContent().find('.roofline').outerWidth() - 10;
            plot_config.height = this.getContent().find('.roofline').outerHeight() - 10;
            functionPlot(plot_config);
        }
    }

    getTitle() {
        return 'Cache-aware roofline model';
    }

    prepareRefresh() {

    }

    prepareClose() {

    }

    _setup(data, existing_window) {
        this.root_window = data;

        this.getContent().find('.roofline_type_select').on(
            'change',
            (event) => {
                this.onRooflineTypeChange(event);
            });
        this.getContent().find('.roofline_l1').on(
            'click',
            () => {
                this.onRooflineBoundsChange('l1');
            });
        this.getContent().find('.roofline_l2').on(
            'click',
            () => {
                this.onRooflineBoundsChange('l2');
            });
        this.getContent().find('.roofline_l3').on(
            'click',
            () => {
                this.onRooflineBoundsChange('l3');
            });
        this.getContent().find('.roofline_dram').on(
            'click',
            () => {
                this.onRooflineBoundsChange('dram');
            });
        this.getContent().find('.roofline_fp').on(
            'click',
            () => {
                this.onRooflineBoundsChange('fp');
            });
        this.getContent().find('.roofline_point_delete').on(
            'click',
            (event) => {
                this.onRooflinePointDeleteClick(event);
            });
        this.getContent().find('.roofline_point_select').on(
            'change',
            (event) => {
                this.onRooflinePointChange(event);
            });

        if ('roofline' in this.root_window.getData().result_cache) {
            this.getData().roofline = this.root_window.getData().result_cache['roofline'];
            this.openRooflinePlot();
            this.hideLoading();
        } else {
            $.ajax({
                url: this.getSession().id + '/' + this.getEntityId() + '/' + this.getNodeId() + '/' + MODULE_NAME,
                method: 'POST',
                dataType: 'json',
                data: {general_analysis: 'roofline'}
            }).done(ajax_obj => {
                this.root_window.getData().result_cache['roofline'] = ajax_obj;
                this.getData().roofline = ajax_obj;
                this.openRooflinePlot();
                this.hideLoading();
            }).fail(ajax_obj => {
                window.alert('Could not load the roofline model!');
                this.hideLoading();
                this.close();
            });
        }
    }

    openRooflinePlot() {
        for (let i = 0; i < this.getData().roofline.models.length; i++) {
            this.getContent().find('.roofline_type_select').append(
                new Option(this.getData().roofline.models[i].isa, i));
        }

        for (const k of Object.keys(this.root_window.getData().roofline_dict)) {
            this.getContent().find('.roofline_point_select').append(
                new Option(k, k));
        }

        let plot_container = this.getContent().find('.roofline');
        let plot_id = this.getId() + '_roofline';
        plot_container.attr('id', plot_id);

        this.getData().roofline.bounds = {
            'l1': true,
            'l2': true,
            'l3': true,
            'dram': true,
            'fp': true
        };
    }

    onRooflinePointDeleteClick(event) {
        let cur_val = this.getContent().find('.roofline_point_select').val();

        if (cur_val !== '' && cur_val != undefined) {
            let confirmed = window.confirm('Are you sure you want to ' +
                                           'delete ' + cur_val + '? ' +
                                           'Click OK to confirm.');

            if (!confirmed) {
                return;
            }

            this.getContent().find('.roofline_point_select').val('');
            this.getContent().find('.roofline_point_ai').html('<i>Select first.</i>');
            this.getContent().find('.roofline_point_perf').html('<i>Select first.</i>');
            this.getContent().find(
                '.roofline_point_select option[value="' + cur_val + '"]').remove()

            delete this.root_window.getData().roofline_dict[cur_val];

            this.updateRoofline();
        }
    }

    onRooflinePointChange(event) {
        let new_val = event.target.value;

        if (new_val === '' || new_val == undefined) {
            this.getContent().find('.roofline_point_ai').html('<i>Select first.</i>');
            this.getContent().find('.roofline_point_perf').html('<i>Select first.</i>');
        } else {
            let point = this.root_window.getData().roofline_dict[new_val];

            this.getContent().find('.roofline_point_ai').text(point[0]);
            this.getContent().find('.roofline_point_perf').text(point[1] / 1000000000);
        }
    }

    updateRoofline() {
        let plot_present = this.getContent().find('.roofline_type_select').val() != null;
        let model = plot_present ?
            this.getData().roofline.models[
                this.getContent().find('.roofline_type_select').val()] : undefined;
        let plot_data = [];
        let for_turning_x = [];

        if (this.getData().roofline.bounds.l1) {
            if (plot_present) {
                plot_data.push(this.getData().roofline.l1_func);
                for_turning_x.push(model.l1.gbps);
            }

            this.getContent().find('.roofline_l1').html('<b>L1:</b> on');
        } else {
            this.getContent().find('.roofline_l1').html('<b>L1:</b> off');
        }

        if (this.getData().roofline.bounds.l2) {
            if (plot_present) {
                plot_data.push(this.getData().roofline.l2_func);
                for_turning_x.push(model.l2.gbps);
            }

            this.getContent().find('.roofline_l2').html('<b>L2:</b> on');
        } else {
            this.getContent().find('.roofline_l2').html('<b>L2:</b> off');
        }

        if (this.getData().roofline.bounds.l3) {
            if (plot_present) {
                plot_data.push(this.getData().roofline.l3_func);
                for_turning_x.push(model.l3.gbps);
            }

            this.getContent().find('.roofline_l3').html('<b>L3:</b> on');
        } else {
            this.getContent().find('.roofline_l3').html('<b>L3:</b> off');
        }

        if (this.getData().roofline.bounds.dram) {
            if (plot_present) {
                plot_data.push(this.getData().roofline.dram_func);
                for_turning_x.push(model.dram.gbps);
            }

            this.getContent().find('.roofline_dram').html('<b>DRAM:</b> on');
        } else {
            this.getContent().find('.roofline_dram').html('<b>DRAM:</b> off');
        }

        if (this.getData().roofline.bounds.fp) {
            if (plot_present) {
                plot_data.push(this.getData().roofline.fp_func);
            }

            this.getContent().find('.roofline_fp').html('<b>FP:</b> on');
        } else {
            this.getContent().find('.roofline_fp').html('<b>FP:</b> off');
        }

        if (plot_present) {
            let turning_x = model.fp_fma.gflops / Math.min(...for_turning_x);

            let max_point_x = 0;
            let max_point_y = 0;

            for (const [name, [x, y]] of Object.entries(this.root_window.getData().roofline_dict)) {
                let scaled_y = y / 1000000000;

                plot_data.push({
                    points: [[x, scaled_y]],
                    fnType: 'points',
                    graphType: 'scatter',
                    color: 'black'
                })

                plot_data.push({
                    graphType: 'text',
                    location: [x, scaled_y],
                    text: name,
                    color: 'black'
                })

                if (x > max_point_x) {
                    max_point_x = x;
                }

                if (scaled_y > max_point_y) {
                    max_point_y = scaled_y;
                }
            }

            this.getData().roofline.plot_config.data = plot_data;
            this.getData().roofline.plot_config.xAxis.domain =
                [0.00390625, turning_x > max_point_x ? 1.5 * turning_x : 1.1 * max_point_x];
            this.getData().roofline.plot_config.yAxis.domain =
                [0.00390625, model.fp_fma.gflops > max_point_y ?
                 1.25 * model.fp_fma.gflops : 1.1 * max_point_y];
            functionPlot(this.getData().roofline.plot_config);
        }
    }

    onRooflineBoundsChange(bound) {
        this.getData().roofline.bounds[bound] = !this.getData().roofline.bounds[bound];
        this.updateRoofline();
    }

    onRooflineTypeChange(event) {
        let type_index = event.currentTarget.value;
        let model = this.getData().roofline.models[type_index];

        this.getContent().find('.roofline_details_text').html(`
        <b>Precision:</b> ${model.precision}<br />
        <b>Threads:</b> ${model.threads}<br />
        <b>Loads:</b> ${model.loads}<br />
        <b>Stores:</b> ${model.stores}<br />
        <b>Interleaved:</b> ${model.interleaved}<br />
        <b>L1 bytes:</b> ${this.getData().roofline.l1}<br />
        <b>L2 bytes:</b> ${this.getData().roofline.l2}<br />
        <b>L3 bytes:</b> ${this.getData().roofline.l3}<br />
        <b>DRAM bytes:</b> ${model.dram_bytes}
    `);

        this.getData().roofline.l1_func = {
            fn: `min(x * ${model.l1.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkred'
        };

        this.getData().roofline.l2_func = {
            fn: `min(x * ${model.l2.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkgreen'
        };

        this.getData().roofline.l3_func = {
            fn: `min(x * ${model.l3.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkblue'
        };

        this.getData().roofline.dram_func = {
            fn: `min(x * ${model.dram.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkgrey'
        };

        this.getData().roofline.fp_func = {
            fn: model.fp.gflops,
            color: 'black',
            graphType: 'scatter',
            nSamples: 100
        }

        let plot_data = [];
        let for_turning_x = [];

        if (this.getData().roofline.bounds.l1) {
            plot_data.push(this.getData().roofline.l1_func);
            for_turning_x.push(model.l1.gbps);
        }

        if (this.getData().roofline.bounds.l2) {
            plot_data.push(this.getData().roofline.l2_func);
            for_turning_x.push(model.l2.gbps);
        }

        if (this.getData().roofline.bounds.l3) {
            plot_data.push(this.getData().roofline.l3_func);
            for_turning_x.push(model.l3.gbps);
        }

        if (this.getData().roofline.bounds.dram) {
            plot_data.push(this.getData().roofline.dram_func);
            for_turning_x.push(model.dram.gbps);
        }

        if (this.getData().roofline.bounds.fp) {
            plot_data.push(this.getData().roofline.fp_func);
        }

        let max_point_x = 0;
        let max_point_y = 0;

        for (const [name, [x, y]] of Object.entries(this.root_window.getData().roofline_dict)) {
            let scaled_y = y / 1000000000;

            plot_data.push({
                points: [[x, scaled_y]],
                fnType: 'points',
                graphType: 'scatter',
                color: 'black'
            })

            plot_data.push({
                graphType: 'text',
                location: [x, scaled_y],
                text: name,
                color: 'black'
            })

            if (x > max_point_x) {
                max_point_x = x;
            }

            if (scaled_y > max_point_y) {
                max_point_y = scaled_y;
            }
        }

        let turning_x = model.fp_fma.gflops / Math.min(...for_turning_x);

        let container = this.getContent().find('.roofline');

        this.getData().roofline.plot_config = {
            target: '#' + this.getId() + '_roofline',
            width: container.width() - 10,
            height: container.height() - 10,
            xAxis: {
                type: 'log',
                domain: [0.00390625, turning_x > max_point_x ?
                         1.5 * turning_x : 1.1 * max_point_x]
            },
            yAxis: {
                type: 'log',
                domain: [0.00390625, model.fp_fma.gflops > max_point_y ?
                         1.25 * model.fp_fma.gflops :
                         1.1 * max_point_y]
            },
            disableZoom: true,
            data: plot_data
        };

        functionPlot(this.getData().roofline.plot_config);
    }
}

class CodeWindow extends Window {
    // Data should have the following form:
    // {
    //     '<path>': {
    //         '<line number>': '<"exact" or [<red in RGB>, <green in RGB>,
    //                                        <blue in RGB>, <alpha from 0.0 to 1.0>,
    //                                        <total value>, <unit string>]>
    //     }
    // }
    //
    // default_path corresponds to <path> to be displayed first
    // when a code preview window is shown.
    static openCode(root_window,
                    data, default_path, session, entity_id, node_id) {
        let load = (code) => {
            new CodeWindow(session, entity_id, node_id, MODULE_NAME, {
                root_window: root_window,
                code: code,
                files_and_lines: data,
                default_file: default_path,
            });
            // new_window.css('top', 'calc(50% - 275px)');
            // new_window.css('left', 'calc(50% - 375px)');
        };

        if (default_path in root_window.getData().src_cache) {
            load(root_window.getData().src_cache[default_path]);
        } else {
            $.ajax({
                url: session.id + '/' + entity_id + '/' + node_id + '/' + MODULE_NAME,
                method: 'POST',
                dataType: 'text',
                data: {src: root_window.getData().src_index_dict[default_path]}
            }).done(src_code => {
                root_window.getData().src_cache[default_path] = src_code;
                load(src_code);
            }).fail(ajax_obj => {
                window.alert('Could not load ' + default_path + '!');
            });
        }
    }

    getType() {
        return 'linuxperf_code';
    }

    getContentCode() {
        return `
<div class="toolbar code_choice">
  <select name="file" class="code_file">
    <option value="" disabled="disabled">
      File to preview...
    </option>
  </select>
  <select name="type" class="code_type">
    <option value="" disabled="disabled">
      Code type...
    </option>
    <option value="original" selected="selected">
      Original
    </option>
  </select>
  <svg xmlns="http://www.w3.org/2000/svg" class="pointer code_copy_all" height="24px" data-icon="copy"
       width="24px" fill="#000000">
    <title>Copy all code</title>
  </svg>
</div>
<div class="window_space code_container">
  <pre><code class="code_box"></code></pre>
</div>
`;
    }

    startResize() {

    }

    finishResize() {

    }

    prepareRefresh() {

    }

    prepareClose() {

    }

    _setup(data, existing_window) {
        this.root_window = data.root_window;
        for (const f of Object.keys(data.files_and_lines)) {
            this.getContent().find('.code_file').append(
                new Option(f, f));
        }
        this.getContent().find('.code_file').val(data.default_file);
        this.getContent().find('.code_file').on('change', (event) => {
            this.onCodeFileChange(event);
        });

        this.getData().files_and_lines =
            structuredClone(data.files_and_lines);

        this.prepareCodePreview(data.code,
                                data.files_and_lines[data.default_file])

        this.hideLoading();
    }

    getTitle() {
        return 'Code preview';
    }

    onCodeFileChange(event) {
        let path = event.currentTarget.value;
        let load = (code) => {
            this.prepareCodePreview(code,
                                    this.getData().files_and_lines[path]);
        };

        if (path in this.root_window.getData().src_cache) {
            load(this.root_window.getData().src_cache[path]);
        } else {
            $.ajax({
                url: this.getSession().id + '/' + this.getEntityId() + '/' + this.getNodeId() + '/' + MODULE_NAME,
                method: 'POST',
                dataType: 'text',
                data: {src: this.root_window.getData().src_index_dict[path]}
            }).done(src_code => {
                this.root_window.getData().src_cache[path] = src_code;
                load(src_code);
            }).fail(ajax_obj => {
                window.alert('Could not load ' + path + '!');
            });
        }
    }

    prepareCodePreview(code, lines) {
        this.getContent().find('.code_container').scrollTop(0);
        let code_box = this.getContent().find('.code_box');
        code_box.html('');

        for (const attr of code_box[0].attributes) {
            if (attr.name === 'class') {
                code_box.attr(attr.name, 'code_box');
            } else {
                code_box.attr(attr.name, '');
            }
        }

        code_box.text(code);
        this.getContent().find('.code_copy_all').off('click');
        this.getContent().find('.code_copy_all').on('click', {
            code: code
        }, (event) => {
            navigator.clipboard.writeText(event.data.code);
            window.alert('Code copied to clipboard!');
        });

        let line_to_go = undefined;

        hljs.highlightElement(this.getContent().find('.code_box')[0]);
        hljs.lineNumbersBlockSync(this.getContent().find('.code_box')[0]);

        let numf = new Intl.NumberFormat('en-US');

        for (const [line, how] of Object.entries(lines)) {
            let num_elem = this.getContent().find('.hljs-ln-numbers[data-line-number="' + line + '"]');
            let line_elem = this.getContent().find('.hljs-ln-code[data-line-number="' + line + '"]');

            num_elem.css('text-decoration', 'underline');
            num_elem.css('font-weight', 'bold');
            num_elem.css('cursor', 'help');

            if (how === 'exact') {
                num_elem.attr('title', 'Spawned by this line');
            } else {
                if (how[0] === 'walltime') {
                    let sum = how[5] + how[6];

                    if (how[5] === sum) {
                        num_elem.attr('title', numf.format(sum) + ' ' +
                                      how[7] + ' (' + (how[4] * 100).toFixed(2) + '% of the block)\n\n' +
                                      'On-CPU: 100.00% of the line, ' + numf.format(how[5]) + ' ' + how[7]);
                    } else if (how[6] === sum) {
                        num_elem.attr('title', numf.format(sum) + ' ' +
                                      how[7] + ' (' + (how[4] * 100).toFixed(2) + '% of the block)\n\n' +
                                      'Off-CPU: 100.00% of the line, ' + numf.format(how[6]) + ' ' + how[7]);
                    } else {
                        num_elem.attr('title', numf.format(sum) + ' ' +
                                      how[7] + ' (' + (how[4] * 100).toFixed(2) + '% of the block)\n\n' +
                                      'On-CPU: ' + (((1.0 * how[5]) / (1.0 * sum)) * 100).toFized(2) + '% of the line, ' + numf.format(how[5]) + ' ' + how[7] + '<br />' +
                                      'Off-CPU: ' + (((1.0 * how[6]) / (1.0 * sum)) * 100).toFized(2) + '% of the line, ' + numf.format(how[6]) + ' ' + how[7]);
                    }
                } else {
                    num_elem.attr('title', numf.format(how[5]) + ' ' +
                                  how[6] + ' (' + (how[4] * 100).toFixed(2) + '% of the block)');
                }
            }

            let background_color = how === 'exact' ? 'lightgray' :
                'rgba(' + how[1] + ', ' + how[2] + ', ' + how[3] + ', ' + how[4] + ')';

            line_elem.css('background-color', background_color);

            if (line_to_go === undefined || line < line_to_go) {
                line_to_go = line;
            }
        }

        if (line_to_go !== undefined) {
            if (line_to_go > 3) {
                line_to_go -= 3;
            } else {
                line_to_go = 1;
            }

            let container = this.getContent().find('.code_container');
            container.scrollTop(this.getContent().find(
                '.hljs-ln-numbers[data-line-number="' + line_to_go + '"]').offset().top -
                                container.offset().top);
        }
    }
}

function createRootWindow(entity_id, node_id, session) {
    return new TimelineWindow(session, entity_id, node_id, MODULE_NAME, {});
}

function checkValidPercentage(event) {
    let input = event.target;

    if (input.value === '' || input.value === undefined) {
        input.value = '0';
    } else {
        let number = parseFloat(input.value);

        if (isNaN(number)) {
            input.value = '0';
        } else if (input.min !== undefined && input.min !== '' &&
                   number < input.min) {
            input.value = input.min;
        } else if (input.max !== undefined && input.max !== '' &&
                   number > input.max) {
            input.value = input.max;
        } else if (event.key === 'Enter') {
            input.value = number;
        }
    }
}

function insertValidPercentage(input) {
    let number = parseFloat(input.value);

    if (isNaN(number)) {
        input.value = '0';
    } else {
        input.value = number;
    }
}

export { createRootWindow };
