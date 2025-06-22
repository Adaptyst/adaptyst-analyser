class TimelineWindow extends Window {
    getType() {
        return 'linuxperf_timeline';
    }

    getTitle() {
        return 'CPU timeline';
    }

    getContentCode() {
        return `
<div class="toolbar">
    <svg class="general_analyses" xmlns="http://www.w3.org/2000/svg"
         height="24px"
         viewBox="0 -960 960 960" width="px" fill="#000000"
         onclick="" class="disabled">
      <title>General analyses</title>
      <path d="M282.67-278h66.66v-203.33h-66.66V-278Zm328 0h66.66v-413.33h-66.66V-278Zm-164 0h66.66v-118.67h-66.66V-278Zm0-203.33h66.66V-548h-66.66v66.67ZM186.67-120q-27 0-46.84-19.83Q120-159.67 120-186.67v-586.66q0-27 19.83-46.84Q159.67-840 186.67-840h586.66q27 0 46.84 19.83Q840-800.33 840-773.33v586.66q0 27-19.83 46.84Q800.33-120 773.33-120H186.67Zm0-66.67h586.66v-586.66H186.67v586.66Zm0-586.66v586.66-586.66Z"/>
    </svg>
    <div id="glossary">
      <b><font color="#aa0000">Red parts</font></b> are on-CPU and
      <b><font color="#0294e3">blue parts</font></b> are off-CPU. <b>Right-click</b>
      any thread/process to open the details menu.
    </div>
    <div id="off_cpu_sampling_warning">
      <b><font color="#ff0000">WARNING:</font></b> The current off-CPU timeline
      display scale is <span class="off_cpu_scale_value"></span>, which means that <b>the timeline does
        not show off-CPU periods missing the sampling period of <span class="off_cpu_sampling_period"></span> ms!</b> <b><u>No</u></b> other analyses are affected.
    </div>
    <div id="no_off_cpu_warning">
      <b><font color="#ff0000">WARNING:</font></b> The current off-CPU timeline
      display scale is 0, which means that <b>the timeline does
        not show any off-CPU periods!</b> <b><u>No</u></b> other analyses are affected.
    </div>
</div>
<div class="window_space linuxperf_timeline"></div>
`;
    }

    _setup(data, existing_window) {
        this.offcpu_sampling = 0;
        this.show_no_off_cpu_warning = false;

        function from_json_to_item(parent, json, level,
                                   item_list, group_list,
                                   item_dict, metrics_dict,
                                   callchain_dict, tooltip_dict,
                                   warning_dict, overall_end_time,
                                   general_metrics_dict,
                                   sampled_diff_dict,
                                   src_dict, src_index_dict,
                                   roofline_info,
                                   max_off_cpu_sampling) {
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
                        parent.offcpu_sampling = Math.round(Math.pow(
                            1 - offcpu_sampling_raw, 3) * max_off_cpu_sampling);
                    }
                }

                for (let i = 0; i < json.off_cpu.length; i++) {
                    let start = json.off_cpu[i][0];
                    let end = start + json.off_cpu[i][1];

                    if (parent.offcpu_sampling === 0 ||
                        start % parent.offcpu_sampling === 0 ||
                        end % parent.offcpu_sampling === 0 ||
                        Math.floor(start / parent.offcpu_sampling) != Math.floor(
                            end / parent.offcpu_sampling)) {
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
                parent.show_no_off_cpu_warning = true;
            }

            for (let i = 0; i < json.children.length; i++) {
                from_json_to_item(parent,
                                  json.children[i],
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

        function part2(parent, init) {
            if (init) {
                from_json_to_item(parent, parent._data, 0,
                                  parent.getNodeData().item_list,
                                  parent.getNodeData().group_list,
                                  parent.getNodeData().item_dict,
                                  parent.getNodeData().metrics_dict,
                                  parent.getNodeData().callchain_dict,
                                  parent.getNodeData().tooltip_dict,
                                  parent.getNodeData().warning_dict,
                                  parent.getNodeData().overall_end_time,
                                  parent.getNodeData().general_metrics_dict,
                                  parent.getNodeData().sampled_diff_dict,
                                  parent.getNodeData().src_dict,
                                  parent.getNodeData().src_index_dict,
                                  parent.getNodeData().roofline_info);
            }

            if ($.isEmptyObject(parent.getNodeData().general_metrics_dict)) {
                parent.dom.find('.general_analyses').attr('onclick', '');
                parent.dom.find('.general_analyses').attr('class', 'disabled');
            } else {
                parent.dom.find('.general_analyses').attr('onclick', 'onGeneralAnalysesClick(event)');
                parent.dom.find('.general_analyses').attr('class', 'pointer');
            }

            let container = parent.dom.find('.linuxperf_timeline');
            container.html('');

            if (parent.show_no_off_cpu_warning) {
                parent.dom.find('.no_off_cpu_warning').show();
            } else if (parent.offcpu_sampling > 0) {
                parent.dom.find('.off_cpu_sampling_period').text(parent.offcpu_sampling);
                parent.dom.find('.off_cpu_scale_value').text(
                    parent.dom.find('.off_cpu_scale').val());
                parent.dom.find('.off_cpu_sampling_warning').show();
            }

            parent.dom.find('.glossary').show();
            parent.hideLoading();

            let timeline = new vis.Timeline(
                container[0],
                parent.getNodeData().item_list,
                parent.getNodeData().group_list,
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
                    max: 2 * parent.getNodeData().overall_end_time[0]
                }
            );

            timeline.on('contextmenu', (props) => {
                if (props.group != null) {
                    let item_list = parent.getNodeData().item_list;
                    let group_list = parent.getNodeData().group_list;
                    let item_dict = parent.getNodeData().item_dict;
                    let callchain_dict = parent.getNodeData().callchain_dict;
                    let callchain_obj = parent.getNodeData().callchain_obj;
                    let metrics_dict = parent.getNodeData().metrics_dict;
                    let tooltip_dict = parent.getNodeData().tooltip_dict;
                    let warning_dict = parent.getNodeData().warning_dict;
                    let general_metrics_dict = parent.getNodeData().general_metrics_dict;
                    let sampled_diff_dict = parent.getNodeData().sampled_diff_dict;
                    let src_dict = parent.getNodeData().src_dict;
                    let src_index_dict = parent.getNodeData().src_index_dict;

                    let items = [
                        {
                            item: $(`
<div class="header_item">
  <span class="runtime"></span>
        <!-- This SVG is from Google Material Icons, originally licensed under
             Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
             (covered by GNU GPL v3 here) -->
        <svg class="runtime_warning" xmlns="http://www.w3.org/2000/svg" height="24px"
             viewBox="0 -960 960 960" width="24px" fill="#ff0000">
          <!-- The line below cannot be broken into multiple ones, so it must
               exceed ~80 characters -->
          <title>WARNING: The difference between the exact and sampled runtime is <span class="sampled_diff"></span>%, which exceeds <span class="runtime_diff_threshold">50</span>%!&#xA;&#xA;For accurate results, you may need to increase the on-CPU and/or off-CPU sampling frequency (depending on whether the process/thread runs mostly on- or off-CPU).</title>
          <path d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z"/>
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
                                                     props.group, parent],
                                                    parent.onMenuItemClick],
                                    hover: true});
                            }
                        } else {
                            items.push({
                                item: $(`<div>${v.title}</div>`),
                                click_handler: [[k, props.group, parent],
                                                parent.onMenuItemClick],
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
                                                CodeWindow.openCode(data, event.data.file,
                                                                    parent.session, parent.node_id);
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
            url: this.session.id + '/' + this.node_id + '/',
            method: 'POST',
            dataType: 'json',
            data: {thread_tree: true}
        }).done(ajax_obj => {
            this._data = ajax_obj;
            $.ajax({
                url: this.session.id + '/' + this.node_id + '/',
                method: 'POST',
                dataType: 'json',
                data: {callchain: true}
            }).done(ajax_obj => {
                this.getNodeData().callchain_obj = ajax_obj;
                part2(this, !existing_window);
            }).fail(ajax_obj => {
                alert('Could not obtain the callchain mappings! You ' +
                      'will not get meaningful names when checking ' +
                      'any stack traces.');
                part2(this, !existing_window);
            });
        }).fail(ajax_obj => {
            alert('Could not download the node data!');
        });
    }

    onGeneralAnalysesClick(event) {
        let metrics_dict = this.getNodeData().general_metrics_dict;

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
                click_handler: [k, onMenuItemClick]});
        }

        Menu.createMenuWithCustomBlocks(event.pageX, event.pageY, items);

        event.preventDefault();
        event.stopPropagation();

        Menu.closeMenu();
    }

    onMenuItemClick(event) {
        let analysis_type = event.data.data[0];
        let timeline_group_id = event.data.data[1];
        let parent = event.data.data[2];

        if (analysis_type === 'flame_graphs') {
            new FlameGraphWindow('body', parent.session,
                                 parent.node_id, {
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
    <!-- This SVG is from Google Material Icons, originally licensed under
         Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
         (covered by GNU GPL v3 here) -->
    <svg class="pointer flamegraph_replace"
         xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960"
         width="24px" fill="#000000">
      <title>Replace (right-click to see the existing replacements)</title>
      <path d="M164-560q14-103 91.5-171.5T440-800q59 0 110.5 22.5T640-716v-84h80v240H480v-80h120q-29-36-69.5-58T440-720q-72 0-127 45.5T244-560h-80Zm620 440L608-296q-36 27-78.5 41.5T440-240q-59 0-110.5-22.5T240-324v84h-80v-240h240v80H280q29 36 69.5 58t90.5 22q72 0 127-45.5T636-480h80q-5 36-18 67.5T664-352l176 176-56 56Z"/>
    </svg>
    <!-- This SVG is from Google Material Icons, originally licensed under
         Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
         (covered by GNU GPL v3 here) -->
    <svg class="pointer flamegraph_download" xmlns="http://www.w3.org/2000/svg" height="24px"
         viewBox="0 -960 960 960" width="24px" fill="#000000">
      <title>Download the current flame graph view as PNG</title>
      <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
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
        if (this.data.flamegraph_obj !== undefined) {
            this.being_resized = true;
        }
    }

    finishResize() {
        let flamegraph_obj = this.data.flamegraph_obj;
        flamegraph_obj.width(this.dom.find('.flamegraph_svg').outerWidth());
        flamegraph_obj.update();
    }

    prepareRefresh() {
        this.setup_data.metric = this.dom.find('.flamegraph_metric').val();
        this.setup_data.time_ordered = this.dom.find('.flamegraph_time_ordered').prop('checked');
    }

    getTitle() {
        return 'Flame graphs';
        //return 'Flame graphs for ' +
        //    session.item_dict[data.timeline_group_id];
    }

    _setup(data, existing_window) {
        this.dom.find('.flamegraph_time_ordered').attr(
            'id', this.id + '_time_ordered');
        this.dom.find('.flamegraph_time_ordered_label').attr(
            'for', this.dom.find('.flamegraph_time_ordered').attr('id'));
        this.dom.find('.flamegraph_search').on('input', () => {
            this.onSearchQueryChange(this.dom.find('.flamegraph_search').val());
        });
        this.dom.find('.flamegraph_time_ordered').on('change', (event) => {
            this.onTimeOrderedChange(event);
        });
        this.dom.find('.flamegraph_metric').on('change', (event) => {
            this.onMetricChange(event);
        });
        this.dom.find('.flamegraph_download').on('click', () => {
            this.downloadFlameGraph();
        });
        this.dom.find('.flamegraph_replace').on('click', () => {
            this.onFlameGraphReplaceClick();
        });
        this.dom.find('.flamegraph_replace').on('contextmenu', (event) => {
            this.onFlameGraphReplaceRightClick(event);
        });

        let to_remove = [];
        this.dom.find('.flamegraph_metric > option').each(() => {
            if (!this.disabled) {
                to_remove.push($(this));
            }
        });

        for (const opt of to_remove) {
            opt.remove();
        }

        this.metrics_dict = this.getNodeData().metrics_dict[data.timeline_group_id];
        let show_carm_checked = $('#show_carm').prop('checked');
        let target_metric_present = false;
        for (const [k, v] of Object.entries(this.metrics_dict)) {
            if (show_carm_checked ||
                !v.title.startsWith('CARM_')) {
                this.dom.find('.flamegraph_metric').append(
                    new Option(v.title, k));

                if (k === data.metric) {
                    target_metric_present = true;
                }
            }
        }

        let metric = target_metric_present ? data.metric : 'walltime';
        this.dom.find('.flamegraph_metric').val(metric);
        this.dom.find('.flamegraph_time_ordered').prop(
            'checked', data.time_ordered === undefined ? false : data.time_ordered);
        this.dom.find('.flamegraph').attr('data-id', data.timeline_group_id);

        this.data.replacements = {};

        if (data.timeline_group_id + '_' +
            parseFloat($('#threshold_input').val()) in this.getNodeData().result_cache) {
            this.data.result_obj = this.getNodeData().result_cache[
                data.timeline_group_id + '_' + parseFloat($(
                    '#threshold_input').val())];

            if (!(metric in this.data.result_obj)) {
                this.data.flamegraph_obj = undefined;
                this.dom.find('.flamegraph_svg').hide();
                this.dom.find('.flamegraph_search').val('');
                this.dom.find('.no_flamegraph').show();
            } else {
                this.openFlameGraph(metric);
            }

            this.hideLoading();
        } else {
            let pid_tid = data.timeline_group_id.split('_');

            $.ajax({
                url: this.session.id + '/' + this.node_id,
                method: 'POST',
                dataType: 'json',
                data: {pid: pid_tid[0], tid: pid_tid[1],
                       threshold: 1.0 * parseFloat($(
                           '#threshold_input').val()) / 100}
            }).done(ajax_obj => {
                this.getNodeData().result_cache[
                    data.timeline_group_id + '_' + parseFloat($(
                        '#threshold_input').val())] = ajax_obj;
                this.data.result_obj = ajax_obj;

                if (!(metric in this.data.result_obj)) {
                    this.data.flamegraph_obj = undefined;
                    this.dom.find('.flamegraph_svg').hide();
                    this.dom.find('.flamegraph_search').val('');
                    this.dom.find('.no_flamegraph').show();
                } else {
                    this.openFlameGraph(metric);
                }

                this.hideLoading();
            }).fail(ajax_obj => {
                this.data.flamegraph_obj = undefined;
                this.dom.find('.flamegraph_svg').hide();
                this.dom.find('.flamegraph_search').val('');
                this.dom.find('.no_flamegraph').show();
                this.hideLoading();
            });
        }
    }

    updateFlameGraph(data, always_change_height) {
        let flamegraph_obj = this.data.flamegraph_obj;
        if (flamegraph_obj !== undefined) {
            let update_height = () => {
                let flamegraph_svg = this.dom.find('.flamegraph_svg').children()[0];

                if (flamegraph_svg !== undefined) {
                    let target_height = flamegraph_svg.getBBox().height;

                    if (always_change_height || target_height > this.dom.find('.flamegraph_svg').outerHeight()) {
                        this.dom.find('.flamegraph_svg').height(target_height);
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
                                                        this.metrics_dict[metric].unit];
                } else {
                    sums[decoded.file][decoded.line] = [metric, 0, 255, 0, 0, 0,
                                                        this.metrics_dict[metric].unit];
                }
            }

            sums[decoded.file][decoded.line][4] += (val_sum / node.data.value);
            sums[decoded.file][decoded.line][5] += val.hot_value;

            if (metric === 'walltime') {
                sums[decoded.file][decoded.line][6] += val.cold_value;
            }
        }

        CodeWindow.openCode(sums, Object.keys(sums)[0], this.session, this.node_id);
    }

    onAddToRooflineClick(event) {
        let info = this.getNodeData().roofline_info;
        let result_obj = this.data.result_obj;
        let exists = false;

        do {
            let name = window.prompt((exists ? 'This name already exists!\n\n' : '') +
                                     'What name do you want to give to your new roofline point?');

            if (name == undefined || name === "") {
                return;
            }

            exists = name in this.getNodeData().roofline_dict;
        } while (exists);

        let trace = [];
        let node = event.data.data.node;
        let cur_callchain_obj = this.getNodeData().callchain_obj[this.dom.find('.flamegraph_metric').val()];

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
                               this.getNodeData().callchain_obj[k]]);
            }
        }

        for (const k of instr_keys) {
            if (result_obj[k] === undefined) {
                instr_nodes.push([undefined]);
            } else {
                instr_nodes.push([result_obj[k][0],
                                  this.getNodeData().callchain_obj[k]]);
            }
        }

        let walltime_node = [[result_obj['walltime'][0],
                              this.getNodeData().callchain_obj['walltime']]];

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

        this.getNodeData().roofline_dict[name] = [arith_intensity, flops];

        for (const v of Object.values(Window.instances)) {
            if (v.type === 'roofline' &&
                v.session === this.session &&
                v.node_id === this.node_id) {
                v.dom.find('.roofline_point_select').append(
                    new Option(name, name));
                updateRoofline(this.dom, v.data);
            }
        }
    }

    openFlameGraph(metric) {
        let result_obj = this.data.result_obj;
        this.data.flamegraph_obj = flamegraph();
        let flamegraph_obj = this.data.flamegraph_obj;
        flamegraph_obj.inverted(true);
        flamegraph_obj.sort(this.dom.find('.flamegraph_time_ordered').prop('checked') ? false : true);
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
            if (node.data.name in this.getNodeData().callchain_obj[this.dom.find('.flamegraph_metric').val()]) {
                let symbol = this.getNodeData().callchain_obj[this.dom.find('.flamegraph_metric').val()][node.data.name];
                result = new String(symbol[0]);
            } else {
                result = new String(node.data.name);
            }

            for (const [k, v] of Object.entries(
                this.data.replacements)) {
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
                this.updateFlameGraph(d3.select('#' + this.dom.find('.flamegraph_svg').attr('id')).datum().data, false);
            }
        });
        flamegraph_obj.onContextMenu((event, node) => {
            Menu.closeMenu();

            let options = [];

            if (!this.dom.find('.flamegraph_time_ordered').prop('checked') &&
                'roofline' in this.getNodeData().general_metrics_dict) {
                options.push(['Add to the roofline plot', [{
                    'node': node,
                    'window': this
                }, onAddToRooflineClick]]);
            }

            let symbol = this.getNodeData().callchain_obj[this.dom.find('.flamegraph_metric').val()][node.data.name];

            if (symbol !== undefined && this.getNodeData().src_dict[symbol[1]] !== undefined) {
                let offset_dict = this.getNodeData().src_dict[symbol[1]];
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
                        'session': this.session,
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
            let name = this.data.flamegraph_obj.getName()(node).valueOf();

            if (metric === 'walltime' && name !== '(compressed)') {
                if (node.data.hot_value === node.data.value) {
                    return name + ': ' + (100 * (node.x1 - node.x0)).toFixed(2) + '% of the entire execution time, ' + numf.format(node.data.value) + ' ' +
                        this.metrics_dict[metric].unit + '\n\nOn-CPU: 100.00% of the block, ' +
                        numf.format(node.data.value) +
                        ' ' + this.metrics_dict[metric].unit;
                } else if (node.data.cold_value === node.data.value) {
                    return name + ': ' + (100 * (node.x1 - node.x0)).toFixed(2) + '% of the entire execution time, ' + numf.format(node.data.value) + ' ' +
                        this.metrics_dict[metric].unit + '\n\nOff-CPU: 100.00% of the block, ' +
                        numf.format(node.data.value) +
                        ' ' + this.metrics_dict[metric].unit;
                } else {
                    return name + ': ' + (100 * (node.x1 - node.x0)).toFixed(2) + '% of the entire execution time, ' + numf.format(node.data.value) + ' ' +
                        this.metrics_dict[metric].unit + '\n\nOn-CPU: ' +
                        (100 * ((1.0 * node.data.hot_value) /
                                (1.0 * node.data.value))).toFixed(2) + '% of the block, ' +
                        numf.format(node.data.hot_value) +
                        ' ' + this.metrics_dict[metric].unit + '\nOff-CPU: ' +
                        (100 * ((1.0 * node.data.cold_value) /
                                (1.0 * node.data.value))).toFixed(2) + '% of the block, ' +
                        numf.format(node.data.cold_value) + ' ' +
                        this.metrics_dict[metric].unit;
                }
            } else {
                if (name === '(compressed)') {
                    return 'This block is compressed, click it to expand it.\n\n' +
                    (100 * (node.x1 - node.x0)).toFixed(2) + '% overall, ' +
                    numf.format(node.data.value) +
                        ' ' + this.metrics_dict[metric].unit;
                } else {
                    return name + ': ' +
                    (100 * (node.x1 - node.x0)).toFixed(2) + '% overall, ' +
                    numf.format(node.data.value) +
                        ' ' + this.metrics_dict[metric].unit;
                }
            }
        });
        flamegraph_obj.setSearchHandler((results, sum, total) => {
            this.dom.find('.flamegraph_search_blocks').html(results.length.toLocaleString());
            this.dom.find('.flamegraph_search_found').html(sum.toLocaleString());
            this.dom.find('.flamegraph_search_total').html(this.data.total.toLocaleString());
            this.dom.find('.flamegraph_search_percentage').html(
                (1.0 * sum / this.data.total * 100).toFixed(2));
        });

        if (metric !== 'walltime') {
            flamegraph_obj.setColorHue('green');
        }

        this.dom.find('.no_flamegraph').hide();
        this.dom.find('.flamegraph_svg').html('');
        this.dom.find('.flamegraph_search').val('');
        this.dom.find('.flamegraph_search_results').hide();
        this.dom.find('.flamegraph_svg').attr(
            'id', this.id + '_flamegraph_svg');
        this.dom.find('.flamegraph_svg').show();
        flamegraph_obj.width(this.dom.find('.flamegraph').outerWidth());
        d3.select('#' + this.dom.find('.flamegraph_svg').attr('id')).datum(structuredClone(
            result_obj[metric][
                this.dom.find('.flamegraph_time_ordered').prop('checked') ? 1 : 0])).call(
                    flamegraph_obj);
        this.data.total =
            d3.select('#' + this.dom.find('.flamegraph_svg').attr('id')).datum().data['value'];
        this.updateFlameGraph(null, true);
        flamegraph_obj.width(this.dom.find('.flamegraph_svg').outerWidth());
        flamegraph_obj.update();

        this.dom.find('.flamegraph')[0].scrollTop = 0;
    }

    onFlameGraphReplaceClick() {
        let query = window.prompt(
            'Please enter a regular expression to be replaced in ' +
                'the flame graph.',
            this.dom.find('.flamegraph_search').val());

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

        this.data.replacements[query] = replacement;
        this.data.flamegraph_obj.update();
    }

    onFlameGraphReplaceRightClick(event) {
        stopPropagation(event);

        let options = [];

        for (const [k, v] of Object.entries(
            this.data.replacements)) {
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

        let replacements = this.data.replacements;

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
            this.data.flamegraph_obj.update();
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

        this.data.replacements[query] = replacement;
        this.data.flamegraph_obj.update();
    }

    onMetricChange(event) {
        let result_obj = this.data.result_obj;
        let metric = event.currentTarget.value;

        this.data.flamegraph_obj = undefined;
        this.dom.find('.flamegraph_time_ordered').prop('checked', false);

        if (metric in result_obj) {
            this.openFlameGraph(metric);
        } else {
            this.dom.find('.flamegraph_search').val('');
            this.dom.find('.flamegraph_search_results').hide();
            this.dom.find('.flamegraph_svg').hide();
            this.dom.find('.no_flamegraph').show();
        }
    }

    onTimeOrderedChange(event) {
        let flamegraph_obj = this.data.flamegraph_obj;
        let result_obj = this.data.result_obj;
        if (flamegraph_obj !== undefined) {
            flamegraph_obj.sort(!event.currentTarget.checked);
            this.updateFlameGraph(structuredClone(
                result_obj[this.dom.find('.flamegraph_metric').val()][
                    event.currentTarget.checked ? 1 : 0]), true);

            this.dom.find('.flamegraph_search').val('');
            this.dom.find('.flamegraph_search_results').hide();
        }
    }

    onSearchQueryChange(value) {
        let flamegraph_obj = this.data.flamegraph_obj;
        if (flamegraph_obj !== undefined) {
            if (value === undefined || value === "") {
                this.dom.find('.flamegraph_search_results').hide();
            } else {
                this.dom.find('.flamegraph_search_results').show();
            }

            flamegraph_obj.search(value);
        }
    }

    // downloadFlameGraph() is based on https://stackoverflow.com/a/28226736
    // (originally CC BY-SA 4.0, covered by GNU GPL v3 here)
    downloadFlameGraph() {
        let flamegraph_obj = this.data.flamegraph_obj;

        if (flamegraph_obj === undefined) {
            return;
        }

        let filename = window.prompt(
            'What filename do you want? ' +
                '(".png" will be added automatically)');

        if (filename == undefined || filename === "") {
            return;
        }

        let svg = this.dom.find('.flamegraph_svg').children()[0].cloneNode(true);
        let style = document.createElement('style');

        style.innerHTML = $('#viewer_script').attr('data-d3-flamegraph-css');

        svg.insertBefore(style, svg.firstChild);

        let url = URL.createObjectURL(new Blob(
            [(new XMLSerializer()).serializeToString(svg)],
            { type: 'image/svg+xml;charset=utf-8' }));

        let image = new Image();
        image.onload = () => {
            let canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext('2d').drawImage(image, 0, 0);

            URL.revokeObjectURL(url);

            let a = document.createElement('a');
            a.download = filename;
            a.target = '_blank';
            a.href = canvas.toDataURL('image/png');
            a.addEventListener('click', (event) => {
                event.stopPropagation();
            });
            a.click();
        };
        image.onerror = () => {
            window.alert("Could not download the flame graph because " +
                         "of an error!");
        };
        image.width = svg.width.baseVal.value;
        image.height = svg.height.baseVal.value;
        image.src = url;
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
        <!-- This SVG is from Google Material Icons, originally licensed under
           Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
           (covered by GNU GPL v3 here) -->
        <svg class="roofline_point_delete" xmlns="http://www.w3.org/2000/svg"
             height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000">
           <title>Delete point</title>
           <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
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
        this.being_resized = true;
        this.dom.find('.roofline').html('');
    }

    finishResize() {
        if (this.data.plot_config !== undefined &&
            this.dom.find('.roofline_type_select').val() != null) {
            this.dom.find('.roofline').html('');

            let plot_config = this.data.plot_config;
            plot_config.width = this.dom.find('.roofline').outerWidth() - 10;
            plot_config.height = this.dom.find('.roofline').outerHeight() - 10;
            functionPlot(plot_config);
        }
    }

    getTitle() {
        return 'Cache-aware roofline model';
    }

    _setup(data, existing_window) {
        this.dom.find('.roofline_type_select').attr(
            'onchange', 'onRooflineTypeChange(event, ' +
                '\'' + this.id + '\')');
        this.dom.find('.roofline_l1').attr(
            'onclick', 'onRooflineBoundsChange(\'l1\', \'' +
                this.id + '\')');
        this.dom.find('.roofline_l2').attr(
            'onclick', 'onRooflineBoundsChange(\'l2\', \'' +
                this.id + '\')');
        this.dom.find('.roofline_l3').attr(
            'onclick', 'onRooflineBoundsChange(\'l3\', \'' +
                this.id + '\')');
        this.dom.find('.roofline_dram').attr(
            'onclick', 'onRooflineBoundsChange(\'dram\', \'' +
                this.id + '\')');
        this.dom.find('.roofline_fp').attr(
            'onclick', 'onRooflineBoundsChange(\'fp\', \'' +
                this.id + '\')');
        this.dom.find('.roofline_point_delete').attr(
            'onclick', 'onRooflinePointDeleteClick(event, ' +
                '\'' + this.id + '\')');
        this.dom.find('.roofline_point_select').attr(
            'onchange', 'onRooflinePointChange(event, ' +
                '\'' + this.id + '\')');

        if (this.getType() in this.getNodeData().result_cache) {
            this.data = this.getNodeData().result_cache[type];
            this.openRooflinePlot(this.getNodeData().result_cache[this.getType()]);
            this.hideLoading();
        } else {
            $.ajax({
                url: this.session + '/',
                method: 'POST',
                dataType: 'json',
                data: {general_analysis: type}
            }).done(ajax_obj => {
                this.getNodeData().result_cache[type] = ajax_obj;
                this.data = ajax_obj;
                openRooflinePlot(window_obj, ajax_obj);
                this.hideLoading();
            }).fail(ajax_obj => {
                window.alert('Could not load the roofline model!');
                this.hideLoading();
                this.close();
            });
        }
    }

    openRooflinePlot() {
        for (let i = 0; i < this.data.models.length; i++) {
            this.dom.find('.roofline_type_select').append(
                new Option(this.data.models[i].isa, i));
        }

        for (const k of Object.keys(this.getNodeData().roofline_dict)) {
            this.dom.find('.roofline_point_select').append(
                new Option(k, k));
        }

        let plot_container = this.dom.find('.roofline');
        let plot_id = this.id + '_roofline';
        plot_container.attr('id', plot_id);

        this.data.bounds = {
            'l1': true,
            'l2': true,
            'l3': true,
            'dram': true,
            'fp': true
        };
    }

    onRooflinePointDeleteClick(event) {
        let cur_val = this.dom.find('.roofline_point_select').val();

        if (cur_val !== '' && cur_val != undefined) {
            let confirmed = window.confirm('Are you sure you want to ' +
                                           'delete ' + cur_val + '? ' +
                                           'Click OK to confirm.');

            if (!confirmed) {
                return;
            }

            this.dom.find('.roofline_point_select').val('');
            this.dom.find('.roofline_point_ai').html('<i>Select first.</i>');
            this.dom.find('.roofline_point_perf').html('<i>Select first.</i>');
            this.dom.find(
                '.roofline_point_select option[value="' + cur_val + '"]').remove()

            delete this.getNodeData().roofline_dict[cur_val];

            updateRoofline(this.dom, this.data);
        }
    }

    onRooflinePointChange(event) {
        let new_val = event.target.value;

        if (new_val === '' || new_val == undefined) {
            this.dom.find('.roofline_point_ai').html('<i>Select first.</i>');
            this.dom.find('.roofline_point_perf').html('<i>Select first.</i>');
        } else {
            let point = this.getNodeData().roofline_dict[new_val];

            this.dom.find('.roofline_point_ai').text(point[0]);
            this.dom.find('.roofline_point_perf').text(point[1] / 1000000000);
        }
    }

    updateRoofline() {
        let plot_present = this.dom.find('.roofline_type_select').val() != null;
        let model = plot_present ?
            this.data.models[
                this.dom.find('.roofline_type_select').val()] : undefined;
        let plot_data = [];
        let for_turning_x = [];

        if (this.data.bounds.l1) {
            if (plot_present) {
                plot_data.push(this.data.l1_func);
                for_turning_x.push(model.l1.gbps);
            }

            this.dom.find('.roofline_l1').html('<b>L1:</b> on');
        } else {
            this.dom.find('.roofline_l1').html('<b>L1:</b> off');
        }

        if (this.data.bounds.l2) {
            if (plot_present) {
                plot_data.push(this.data.l2_func);
                for_turning_x.push(model.l2.gbps);
            }

            this.dom.find('.roofline_l2').html('<b>L2:</b> on');
        } else {
            this.dom.find('.roofline_l2').html('<b>L2:</b> off');
        }

        if (this.data.bounds.l3) {
            if (plot_present) {
                plot_data.push(this.data.l3_func);
                for_turning_x.push(model.l3.gbps);
            }

            this.dom.find('.roofline_l3').html('<b>L3:</b> on');
        } else {
            this.dom.find('.roofline_l3').html('<b>L3:</b> off');
        }

        if (this.data.bounds.dram) {
            if (plot_present) {
                plot_data.push(this.data.dram_func);
                for_turning_x.push(model.dram.gbps);
            }

            this.dom.find('.roofline_dram').html('<b>DRAM:</b> on');
        } else {
            this.dom.find('.roofline_dram').html('<b>DRAM:</b> off');
        }

        if (this.data.bounds.fp) {
            if (plot_present) {
                plot_data.push(this.data.fp_func);
            }

            this.dom.find('.roofline_fp').html('<b>FP:</b> on');
        } else {
            this.dom.find('.roofline_fp').html('<b>FP:</b> off');
        }

        if (plot_present) {
            let turning_x = model.fp_fma.gflops / Math.min(...for_turning_x);

            let max_point_x = 0;
            let max_point_y = 0;

            for (const [name, [x, y]] of Object.entries(this.getNodeData().roofline_dict)) {
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

            this.data.plot_config.data = plot_data;
            this.data.plot_config.xAxis.domain =
                [0.00390625, turning_x > max_point_x ? 1.5 * turning_x : 1.1 * max_point_x];
            this.data.plot_config.yAxis.domain =
                [0.00390625, model.fp_fma.gflops > max_point_y ?
                 1.25 * model.fp_fma.gflops : 1.1 * max_point_y];
            functionPlot(this.data.plot_config);
        }
    }

    onRooflineBoundsChange(bound) {
        this.data.bounds[bound] = !this.data.bounds[bound];
        updateRoofline();
    }

    onRooflineTypeChange(event) {
        let type_index = event.currentTarget.value;
        let model = this.data.models[type_index];

        this.dom.find('.roofline_details_text').html(`
        <b>Precision:</b> ${model.precision}<br />
        <b>Threads:</b> ${model.threads}<br />
        <b>Loads:</b> ${model.loads}<br />
        <b>Stores:</b> ${model.stores}<br />
        <b>Interleaved:</b> ${model.interleaved}<br />
        <b>L1 bytes:</b> ${this.data.l1}<br />
        <b>L2 bytes:</b> ${this.data.l2}<br />
        <b>L3 bytes:</b> ${this.data.l3}<br />
        <b>DRAM bytes:</b> ${model.dram_bytes}
    `);

        this.data.l1_func = {
            fn: `min(x * ${model.l1.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkred'
        };

        this.data.l2_func = {
            fn: `min(x * ${model.l2.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkgreen'
        };

        this.data.l3_func = {
            fn: `min(x * ${model.l3.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkblue'
        };

        this.data.dram_func = {
            fn: `min(x * ${model.dram.gbps}, ${model.fp_fma.gflops})`,
            color: 'darkgrey'
        };

        this.data.fp_func = {
            fn: model.fp.gflops,
            color: 'black',
            graphType: 'scatter',
            nSamples: 100
        }

        let plot_data = [];
        let for_turning_x = [];

        if (this.data.bounds.l1) {
            plot_data.push(this.data.l1_func);
            for_turning_x.push(model.l1.gbps);
        }

        if (this.data.bounds.l2) {
            plot_data.push(this.data.l2_func);
            for_turning_x.push(model.l2.gbps);
        }

        if (this.data.bounds.l3) {
            plot_data.push(this.data.l3_func);
            for_turning_x.push(model.l3.gbps);
        }

        if (this.data.bounds.dram) {
            plot_data.push(this.data.dram_func);
            for_turning_x.push(model.dram.gbps);
        }

        if (this.data.bounds.fp) {
            plot_data.push(this.data.fp_func);
        }

        let max_point_x = 0;
        let max_point_y = 0;

        for (const [name, [x, y]] of Object.entries(this.getNodeData().roofline_dict)) {
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

        let container = window_obj.find('.roofline');

        this.data.plot_config = {
            target: '#' + window_id + '_roofline',
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

        functionPlot(this.data.plot_config);
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
    static openCode(data, default_path, session, node_id) {
        let load = (code) => {
            new CodeWindow('body', session, node_id, {
                code: code,
                files_and_lines: data,
                default_file: default_path,
            });
            // new_window.css('top', 'calc(50% - 275px)');
            // new_window.css('left', 'calc(50% - 375px)');
        };

        let node_data = session.node_data[node_id];

        if (default_path in node_data.src_cache) {
            load(node_data.src_cache[default_path]);
        } else {
            $.ajax({
                url: session.id + '/' + node_id + '/',
                method: 'POST',
                dataType: 'text',
                data: {src: node_data.src_index_dict[default_path]}
            }).done(src_code => {
                node_data.src_cache[default_path] = src_code;
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
  <!-- This SVG is from Google Material Icons, originally licensed under
       Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
       (covered by GNU GPL v3 here) -->
  <svg class="pointer code_copy_all" xmlns="http://www.w3.org/2000/svg" height="24px"
       viewBox="0 -960 960 960" width="24px" fill="#000000">
    <title>Copy all code</title>
    <path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z" />
  </svg>
</div>
<div class="window_space code_container">
  <pre><code class="code_box"></code></pre>
</div>
`;
    }

    _setup(data, existing_window) {
        for (const f of Object.keys(data.files_and_lines)) {
            this.dom.find('.code_file').append(
                new Option(f, f));
        }
        this.dom.find('.code_file').val(data.default_file);
        this.dom.find('.code_file').on('change', (event) => {
            this.onCodeFileChange(event);
        });

        this.data.files_and_lines =
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
                                    this.data.files_and_lines[path]);
        };

        if (path in this.getNodeData().src_cache) {
            load(this.getNodeData().src_cache[path]);
        } else {
            $.ajax({
                url: this.session.id + '/' + this.node_id + '/',
                method: 'POST',
                dataType: 'text',
                data: {src: this.getNodeData().src_index_dict[path]}
            }).done(src_code => {
                this.getNodeData().src_cache[path] = src_code;
                load(src_code);
            }).fail(ajax_obj => {
                window.alert('Could not load ' + path + '!');
            });
        }
    }

    prepareCodePreview(code, lines) {
        this.dom.find('.code_container').scrollTop(0);
        let code_box = this.dom.find('.code_box');
        code_box.html('');

        for (const attr of code_box[0].attributes) {
            if (attr.name === 'class') {
                code_box.attr(attr.name, 'code_box');
            } else {
                code_box.attr(attr.name, '');
            }
        }

        code_box.text(code);
        this.dom.find('.code_copy_all').off('click');
        this.dom.find('.code_copy_all').on('click', {
            code: code
        }, (event) => {
            navigator.clipboard.writeText(event.data.code);
            window.alert('Code copied to clipboard!');
        });

        let line_to_go = undefined;

        hljs.highlightElement(this.dom.find('.code_box')[0]);
        hljs.lineNumbersBlockSync(this.dom.find('.code_box')[0]);

        let numf = new Intl.NumberFormat('en-US');

        for (const [line, how] of Object.entries(lines)) {
            let num_elem = this.dom.find('.hljs-ln-numbers[data-line-number="' + line + '"]');
            let line_elem = this.dom.find('.hljs-ln-code[data-line-number="' + line + '"]');

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

            let container = this.dom.find('.code_container');
            container.scrollTop(this.dom.find(
                '.hljs-ln-numbers[data-line-number="' + line_to_go + '"]').offset().top -
                                container.offset().top);
        }
    }
}

function createRootWindow(node_id, session) {
    session.node_data[node_id] = {};
    session.node_data[node_id].item_list = [];
    session.node_data[node_id].group_list = [];
    session.node_data[node_id].item_dict = {};
    session.node_data[node_id].callchain_dict = {};
    session.node_data[node_id].metrics_dict = {};
    session.node_data[node_id].tooltip_dict = {};
    session.node_data[node_id].warning_dict = {};
    session.node_data[node_id].general_metrics_dict = {};
    session.node_data[node_id].perf_maps_cache = {};
    session.node_data[node_id].result_cache = {};
    session.node_data[node_id].sampled_diff_dict = {};
    session.node_data[node_id].src_dict = {};
    session.node_data[node_id].src_index_dict = {};
    session.node_data[node_id].overall_end_time = [0];
    session.node_data[node_id].src_cache = {};
    session.node_data[node_id].roofline_dict = {};
    session.node_data[node_id].roofline_info = {};

    return new TimelineWindow('body', session, node_id, {});
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
