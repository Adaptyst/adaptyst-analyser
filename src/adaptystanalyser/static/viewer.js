// SPDX-FileCopyrightText: 2025 CERN
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Adaptyst Analyser: a tool for analysing performance analysis results

// Window directory structure:
// {
//     '<div ID>': {
//         'type': '<analysis type, e.g. flame_graphs>',
//         'data': {
//             <data relevant to analysis type>
//         },
//         'session': <session ID corresponding to the window>,
//         'collapsed': <whether the window is collapsed>,
//         'last_height': <last window height before becoming invisible, may be undefined>,
//         'min_height': <window minimum height, may be undefined>,
//         'last_focus': <last time the window was focused>
//     }
// }
var window_dict = {};

// (Profiling) session directory structure:
// {
//     '<session ID>': {
//         'label': ...,
//         'result_cache': ...,
//         'callchain_obj': ...,
//         'callchain_dict': ...,
//         'perf_maps_obj': ...,
//         'perf_maps_cache': ...,
//         'sampled_diff_dict': ...,
//         'item_list': ...,
//         'group_list': ...,
//         'item_dict': ...,
//         'callchain_dict': ...,
//         'metrics_dict': ...,
//         'tooltip_dict': ...,
//         'warning_dict': ...,
//         'general_metrics_dict': ...,
//         'overall_end_time': ...,
//         'roofline_dict': ...,
//         'roofline_info': ...
//     }
// }
var session_dict = {};

// Window templates
const type_dict = {
    roofline: `
<div class="roofline_box">
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
`,
    flame_graphs: `
<span class="collapse_info">
  Some blocks may be collapsed to speed up rendering, but you can expand
  them by clicking them.
</span>
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
<div class="flamegraph_search_results">
  <b>Search results:</b> <span class="flamegraph_search_blocks"></span> block(s) accounting for
  <span class="flamegraph_search_found"></span> unit(s) out of
  <span class="flamegraph_search_total"></span> (<span class="flamegraph_search_percentage"></span>%)
</div>
<div class="flamegraph scrollable">
  <p class="no_flamegraph">
    There is no flame graph associated with the selected process/thread,
    metric, and time order (or the flame graph could not be loaded)!
    This may be caused by the inability of capturing a specific event
    for that process/thread (it is a disadvantage of sampling-based
    profiling).
  </p>
  <div class="flamegraph_svg"></div>
</div>
`,
    code: `
<div class="code_choice">
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
<div class="code_container">
  <pre><code class="code_box"></code></pre>
</div>
`
};

function createWindowDOM(type, timeline_group_id,
                         session_id) {
    const window_header = `
<div class="window_header">
    <span class="window_title"></span>
    <span class="window_close" onmousedown="windowStopPropagation(event)">
      <!-- This SVG is from Google Material Icons, originally licensed under
           Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
           (covered by GNU GPL v3 here) -->
      <svg xmlns="http://www.w3.org/2000/svg" height="24px"
           viewBox="0 -960 960 960" width="24px">
        <title>Close</title>
        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
      </svg>
    </span>
   <span class="window_visibility" onmousedown="windowStopPropagation(event)">
      <!-- This SVG is from Google Material Icons, originally licensed under
           Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
           (covered by GNU GPL v3 here) -->
      <svg xmlns="http://www.w3.org/2000/svg" height="24px"
           viewBox="0 -960 960 960" width="24px">
        <title>Toggle visibility</title>
        <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/>
      </svg>
    </span>
   <span class="window_refresh" onmousedown="windowStopPropagation(event)">
      <!-- This SVG is from Google Material Icons, originally licensed under
           Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
           (covered by GNU GPL v3 here) -->
      <svg xmlns="http://www.w3.org/2000/svg" height="24px"
           viewBox="0 -960 960 960" width="24px">
        <title>Reset window contents</title>
        <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
      </svg>
    </span>
  </div>
`;

    if (session_id === undefined) {
        session_id = $('#results_combobox').val();
    }

    var root = $('<div></div>');
    root.attr('class', 'window ' + type + '_window');
    root.append($(window_header));

    var content = $('<div></div>');
    content.attr('class', 'window_content ' + type + '_content');
    content.html(type_dict[type]);

    root.append(content);

    var session_label =
        session_dict[session_id].label;

    var index = 0;
    var new_window_id = undefined;

    if (timeline_group_id === undefined) {
        new_window_id =
            `w_${session_label}_${type}_${index}`;

        while (new_window_id in window_dict) {
            index++;
            new_window_id =
                `w_${session_label}_${type}_${index}`;
        }
    } else {
        new_window_id =
            `w_${session_label}_${type}_${timeline_group_id}_${index}`;

        while (new_window_id in window_dict) {
            index++;
            new_window_id =
                `w_${session_label}_${type}_${timeline_group_id}_${index}`;
        }
    }

    window_dict[new_window_id] = {
        'type': type,
        'data': {},
        'being_resized': false,
        'collapsed': false,
        'last_focus': Date.now(),
        'session': session_id
    };

    root.attr('id', new_window_id);
    root.attr('onclick', 'changeFocus(\'' +
              root.attr('id') + '\')');
    root.attr('onmouseup', 'onWindowMouseUp(\'' +
              root.attr('id') + '\')');
    root.find('.window_header').attr('onmousedown', 'startDrag(event, \'' +
                                     root.attr('id') + '\')');
    root.find('.window_refresh').attr(
        'onclick', 'onWindowRefreshClick(event, \'' +
            root.attr('id') + '\')');
    root.find('.window_visibility').attr(
        'onclick', 'onWindowVisibilityClick(event, \'' +
            root.attr('id') + '\')');
    root.find('.window_close').attr(
        'onclick', 'onWindowCloseClick(\'' +
            root.attr('id') + '\')');

    return root;
}

function createMenuDOM(options) {
    var elem = $('<div id="custom_menu" class="menu_block"></div>');
    var first = true;

    for (const [k, v] of options) {
        var item = $('<div></div>');

        if (first) {
            item.attr('class', 'menu_item_first');
            first = false;
        } else {
            item.attr('class', 'menu_item');
        }

        item.on('click', {
            'data': v[0],
            'handler': v[1]
        }, function(event) {
            onCustomMenuItemClick(event, event.data.handler);
        });

        item.text(k);
        elem.append(item);
    }

    return elem;
}

function onCustomMenuItemClick(event, handler) {
    closeAllMenus(event, true);

    if (handler !== undefined) {
        handler(event);
    }
}

var current_focused_window_id = undefined;
var largest_z_index = 0;

function getSymbolFromMap(addr, map_name, window_id) {
    var session = session_dict[window_id === undefined ?
                               $('#results_combobox').val() :
                               window_dict[window_id].session];
    if ([addr, map_name] in session.perf_maps_cache) {
        return session.perf_maps_cache[[addr, map_name]];
    }

    var regex = /^\[(0x[0-9a-f]+)\]$/;
    var match = regex.exec(addr);

    if (match == null) {
        return addr;
    }

    var addr_int = parseInt(match[1], 16);

    if (map_name in session.perf_maps_obj) {
        var data = session.perf_maps_obj[map_name];
        var start = 0;
        var end = data.length - 1;

        while (start <= end) {
            var middle = Math.floor((start + end) / 2);
            var addr1 = parseInt(data[middle][0], 16);
            var addr2 = parseInt(data[middle][1], 16);

            if (addr_int >= addr1 && addr_int <= addr2) {
                session.perf_maps_cache[[addr, map_name]] = data[middle][2];
                return data[middle][2];
            } else if (addr_int < addr1) {
                end = middle - 1;
            } else {
                start = middle + 1;
            }
        }
    }

    return addr;
}

$(document).on('change', '#results_combobox', loadCurrentSession);

function loadCurrentSession() {
    $('#off_cpu_sampling_warning').hide();
    $('#no_off_cpu_warning').hide();
    $('#glossary').hide();
    $('#general_analyses').attr('class', 'disabled');
    $('#general_analyses').attr('onclick', '');
    $('#refresh').attr('class', 'disabled');
    $('#refresh').attr('onclick', '');
    $('#block').hide();
    $('#loading').show();
    $('#results_combobox option:selected').each(function() {
        var value = $(this).val();
        var label = $(this).attr('data-label');
        var session_init = false;
        var offcpu_sampling = 0;
        var show_no_off_cpu_warning = false;

        if (!(value in session_dict)) {
            session_init = true;
            session_dict[value] = {};
        }

        var ajaxPostOptions = {
            url: value + '/',
            method: 'POST',
            data: {tree: true}
        };

        function parseResult(result) {
            function from_json_to_item(json, level,
                                       item_list, group_list,
                                       item_dict, metrics_dict,
                                       callchain_dict, tooltip_dict,
                                       warning_dict, overall_end_time,
                                       general_metrics_dict,
                                       sampled_diff_dict,
                                       src_dict, src_index_dict,
                                       roofline_info,
                                       max_off_cpu_sampling) {
                var item = {
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

                var sampled_diff = (1.0 * Math.abs(
                    json.runtime - json.sampled_time)) / json.runtime;
                sampled_diff_dict[item.id] = sampled_diff;
                var warning =
                    sampled_diff > 1.0 * parseFloat(
                        $('#runtime_diff_threshold_input').val()) / 100;

                var group = {
                    id: json.id,
                    content: json.name + ' (' + json.pid_tid + ')',
                    style: 'padding-left: ' + (level * 25) + 'px;',
                    showNested: false
                };

                var nestedGroups = [];

                for (var i = 0; i < json.children.length; i++) {
                    nestedGroups.push(json.children[i].id);
                }

                if (nestedGroups.length > 0) {
                    group.nestedGroups = nestedGroups;
                }

                item_list.push(item);
                group_list.push(group);

                var numf = new Intl.NumberFormat('en-US');

                json.runtime = json.runtime.toFixed(3);
                json.sampled_time = json.sampled_time.toFixed(3);

                var default_runtime;
                var default_sampled_time;
                var default_unit;

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
                     ' ' + default_unit + '<br /><span id="tooltip_sampled_runtime">' +
                     '(sampled: ~' +
                     numf.format(default_sampled_time) + ' ' + default_unit +
                     ')</span>',
                     'Runtime: ' +
                     numf.format(json.runtime) +
                     ' ms<br /><span id="tooltip_sampled_runtime">(sampled: ~' +
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

                var offcpu_sampling_raw = parseFloat($('#off_cpu_scale').val());

                if (offcpu_sampling_raw > 0) {
                    if (offcpu_sampling_raw < 1) {
                        if (level === 0) {
                            max_off_cpu_sampling = json.runtime;
                        }

                        if (max_off_cpu_sampling !== undefined) {
                            offcpu_sampling = Math.round(Math.pow(
                                1 - offcpu_sampling_raw, 3) * max_off_cpu_sampling);
                        }
                    }

                    for (var i = 0; i < json.off_cpu.length; i++) {
                        var start = json.off_cpu[i][0];
                        var end = start + json.off_cpu[i][1];

                        if (offcpu_sampling === 0 ||
                            start % offcpu_sampling === 0 ||
                            end % offcpu_sampling === 0 ||
                            Math.floor(start / offcpu_sampling) != Math.floor(
                                end / offcpu_sampling)) {
                            var off_cpu_item = {
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
                    show_no_off_cpu_warning = true;
                }

                for (var i = 0; i < json.children.length; i++) {
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

            function part2() {
                $.ajax({
                    url: $('#block').attr('result_id') + '/',
                    method: 'POST',
                    dataType: 'json',
                    data: {perf_map: true}
                }).done(ajax_obj => {
                    session_dict[value].perf_maps_obj = ajax_obj;
                    part3(true);
                }).fail(ajax_obj => {
                    session_dict[value].perf_maps_obj = {};
                    alert('Could not obtain the perf symbol maps! You ' +
                          'will not get meaningful names when checking ' +
                          'stack traces e.g. for JIT-ed codes.');
                    part3(true);
                });
            }

            function part3(init) {
                if (init) {
                    session_dict[value].label = label;
                    session_dict[value].item_list = [];
                    session_dict[value].group_list = [];
                    session_dict[value].item_dict = {};
                    session_dict[value].callchain_dict = {};
                    session_dict[value].metrics_dict = {};
                    session_dict[value].tooltip_dict = {};
                    session_dict[value].warning_dict = {};
                    session_dict[value].general_metrics_dict = {};
                    session_dict[value].perf_maps_cache = {};
                    session_dict[value].result_cache = {};
                    session_dict[value].sampled_diff_dict = {};
                    session_dict[value].src_dict = {};
                    session_dict[value].src_index_dict = {};
                    session_dict[value].overall_end_time = [0];
                    session_dict[value].src_cache = {};
                    session_dict[value].roofline_dict = {};
                    session_dict[value].roofline_info = {};

                    from_json_to_item(JSON.parse(result), 0,
                                      session_dict[value].item_list,
                                      session_dict[value].group_list,
                                      session_dict[value].item_dict,
                                      session_dict[value].metrics_dict,
                                      session_dict[value].callchain_dict,
                                      session_dict[value].tooltip_dict,
                                      session_dict[value].warning_dict,
                                      session_dict[value].overall_end_time,
                                      session_dict[value].general_metrics_dict,
                                      session_dict[value].sampled_diff_dict,
                                      session_dict[value].src_dict,
                                      session_dict[value].src_index_dict,
                                      session_dict[value].roofline_info);
                }

                if ($.isEmptyObject(session_dict[value].general_metrics_dict)) {
                    $('#general_analyses').attr('onclick', '');
                    $('#general_analyses').attr('class', 'disabled');
                } else {
                    $('#general_analyses').attr('onclick', 'onGeneralAnalysesClick(event)');
                    $('#general_analyses').attr('class', 'pointer');
                }

                var container = $('#block')[0];
                container.innerHTML = '';

                if (show_no_off_cpu_warning) {
                    $('#no_off_cpu_warning').show();
                } else if (offcpu_sampling > 0) {
                    $('#off_cpu_sampling_period').text(offcpu_sampling);
                    $('#off_cpu_scale_value').text($('#off_cpu_scale').val());
                    $('#off_cpu_sampling_warning').show();
                }

                $('#refresh').attr('onclick', 'onSessionRefreshClick(event)');
                $('#refresh').attr('class', 'pointer');
                $('#off_cpu_scale_desc').text(
                    'Off-CPU timeline display scale (please refresh ' +
                        'your session after changing):');
                $('#glossary').show();
                $('#block').show();
                $('#loading').hide();

                var timeline = new vis.Timeline(
                    container,
                    session_dict[value].item_list,
                    session_dict[value].group_list,
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
                        max: 2 * session_dict[value].overall_end_time[0]
                    }
                );

                timeline.on('contextmenu', function (props) {
                    if (props.group != null) {
                        var item_list = session_dict[value].item_list;
                        var group_list = session_dict[value].group_list;
                        var item_dict = session_dict[value].item_dict;
                        var callchain_dict = session_dict[value].callchain_dict;
                        var callchain_obj = session_dict[value].callchain_obj;
                        var metrics_dict = session_dict[value].metrics_dict;
                        var tooltip_dict = session_dict[value].tooltip_dict;
                        var warning_dict = session_dict[value].warning_dict;
                        var general_metrics_dict = session_dict[value].general_metrics_dict;
                        var sampled_diff_dict = session_dict[value].sampled_diff_dict;
                        var src_dict = session_dict[value].src_dict;
                        var src_index_dict = session_dict[value].src_index_dict;

                        if (props.group in callchain_dict) {
                            $('#callchain').html('');

                            var first = true;
                            for (const [name, offset] of callchain_dict[props.group]) {
                                var new_span = $('<span></span>');
                                new_span.css('cursor', 'help');

                                if (callchain_obj !== undefined &&
                                    name in callchain_obj['syscall']) {
                                    var symbol = callchain_obj['syscall'][name];
                                    new_span.text(getSymbolFromMap(symbol[0], symbol[1]));

                                    if (symbol[1] in src_dict &&
                                        offset in src_dict[symbol[1]]) {
                                        var src = src_dict[symbol[1]][offset];
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
                                                function(event) {
                                                    var data = {};
                                                    data[event.data.file] = {}
                                                    data[event.data.file][
                                                        event.data.line] = 'exact';
                                                    closeAllMenus(undefined, true);
                                                    openCode(data, event.data.file);
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
                                    $('#callchain').append('<br />');
                                }

                                $('#callchain').append(new_span);
                            }
                            $('#callchain_item').show();
                        } else {
                            $('#callchain_item').hide();
                        }

                        var runtime_select = 0;

                        if ($('#always_ms').prop('checked')) {
                            runtime_select = 1;
                        }

                        $('#runtime').html(
                            tooltip_dict[props.group][runtime_select]);

                        $('#thread_menu_items').empty();

                        var flame_graphs_present = false;

                        for (const [k, v] of Object.entries(metrics_dict[props.group])) {
                            if (v.flame_graph) {
                                if (!flame_graphs_present) {
                                    flame_graphs_present = true;

                                    $(`<div class="menu_item"
                                        onclick="onMenuItemClick(event, 'flame_graphs',
                                        '${props.group}')">
                                          Flame graphs
                                       </div>`).appendTo('#thread_menu_items');
                                }
                            } else {
                                $(`<div class="menu_item"
                                    onclick="onMenuItemClick(event, '${k}', '${props.group}')">
                                     ${v.title}
                                   </div>`).appendTo('#thread_menu_items');
                            }
                        }

                        $('#thread_menu_block').css('top', props.pageY);
                        $('#thread_menu_block').css('left', props.pageX);
                        $('#thread_menu_block').outerHeight('auto');
                        $('#thread_menu_block').css('display', 'flex');
                        $('#thread_menu_block').css('z-index', '10001');

                        if (sampled_diff_dict[props.group] >
                            1.0 * parseFloat($('#runtime_diff_threshold_input').val()) / 100) {
                            $('#tooltip_sampled_runtime').css('color', 'red');
                            $('#sampled_diff').html(
                                (sampled_diff_dict[props.group] * 100).toFixed(2));
                            $('#runtime_diff_threshold').html(
                                parseFloat($('#runtime_diff_threshold_input').val()));
                            $('#runtime_warning').show();
                        } else {
                            $('#tooltip_sampled_runtime').css('color', 'black');
                            $('#runtime_warning').hide();
                        }

                        var height = $('#thread_menu_block').outerHeight();
                        var width = $('#thread_menu_block').outerWidth();

                        if (props.pageY + height > $(window).outerHeight() - 30) {
                            $('#thread_menu_block').outerHeight(
                                $(window).outerHeight() - props.pageY - 30);
                        }

                        if (props.pageX + width > $(window).outerWidth() - 20) {
                            $('#thread_menu_block').css(
                                'left', Math.max(0, props.pageX - width));
                        }

                        props.event.preventDefault();
                        props.event.stopPropagation();

                        closeAllMenus(props.event, false, 'thread_menu_block');
                    }
                });
            }

            $('#block').attr('result_id', value);

            $.ajax({
                url: $('#block').attr('result_id') + '/',
                method: 'POST',
                dataType: 'json',
                data: {callchain: true}
            }).done(ajax_obj => {
                session_dict[value].callchain_obj = ajax_obj;
                part2();
            }).fail(ajax_obj => {
                alert('Could not obtain the callchain mappings! You ' +
                      'will not get meaningful names when checking ' +
                      'any stack traces.');
                part3(true);
            });
        }

        $.ajax(ajaxPostOptions)
            .done(parseResult)
            .fail(function(ajax_obj) {
                if (ajax_obj.status === 500) {
                    alert('Could not load the session because of an ' +
                          'error on the server side!');
                } else {
                    alert('Could not load the session! (HTTP code ' +
                          ajax_obj.status + ')');
                }
                $('#loading').hide();
            });
    });
}

function onSessionRefreshClick(event) {
    loadCurrentSession();
}

function setupWindow(window_obj, type, data) {
    var window_id = window_obj.attr('id');
    var existing_window = false;

    if (data === undefined) {
        data = window_dict[window_id].setup_data;
        existing_window = true;
    }

    var loading_jquery = $('#loading').clone();
    loading_jquery.removeAttr('id');
    loading_jquery.attr('class', 'loading');
    loading_jquery.prependTo(window_obj.find('.window_content'));
    loading_jquery.show();

    if (!existing_window) {
        window_obj.appendTo('body');
        changeFocus(window_obj.attr('id'));
    }

    window_dict[window_id].setup_data = data;

    var session = session_dict[window_dict[window_id].session];
    if (type === 'flame_graphs') {
        window_obj.find('.flamegraph_time_ordered').attr(
            'id', window_obj.attr('id') + '_time_ordered');
        window_obj.find('.flamegraph_time_ordered_label').attr(
            'for', window_obj.find('.flamegraph_time_ordered').attr('id'));
        window_obj.find('.flamegraph_search').attr(
            'oninput', 'onSearchQueryChange(\'' + window_obj.attr('id') + '\',' +
                'this.value)');
        window_obj.find('.flamegraph_time_ordered').attr(
            'onchange', 'onTimeOrderedChange(\'' + window_obj.attr('id') + '\', event)');
        window_obj.find('.flamegraph_metric').attr(
            'onchange', 'onMetricChange(\'' + window_obj.attr('id') + '\', event)');
        window_obj.find('.flamegraph_download').attr(
            'onclick', 'downloadFlameGraph(\'' + window_obj.attr('id') + '\')');
        window_obj.find('.flamegraph_replace').attr(
            'onclick', 'onFlameGraphReplaceClick(\'' +
                window_obj.attr('id') + '\')');
        window_obj.find('.flamegraph_replace').attr(
            'oncontextmenu', 'onFlameGraphReplaceRightClick(event, \'' +
                window_obj.attr('id') + '\')');

        window_obj.find('.window_title').html(
            '[Session: ' + session.label + '] ' +
                'Flame graphs for ' +
                session.item_dict[data.timeline_group_id]);
        var to_remove = [];
        window_obj.find('.flamegraph_metric > option').each(function() {
            if (!this.disabled) {
                to_remove.push($(this));
            }
        });

        for (const opt of to_remove) {
            opt.remove();
        }

        var dict = session.metrics_dict[data.timeline_group_id];
        var show_carm_checked = $('#show_carm').prop('checked');
        var target_metric_present = false;
        for (const [k, v] of Object.entries(dict)) {
            if (show_carm_checked ||
                !v.title.startsWith('CARM_')) {
                window_obj.find('.flamegraph_metric').append(
                    new Option(v.title, k));

                if (k === data.metric) {
                    target_metric_present = true;
                }
            }
        }

        var metric = target_metric_present ? data.metric : 'walltime';
        window_obj.find('.flamegraph_metric').val(metric);
        window_obj.find('.flamegraph_time_ordered').prop(
            'checked', data.time_ordered === undefined ? false : data.time_ordered);
        window_obj.find('.flamegraph').attr('data-id', data.timeline_group_id);

        var window_id = window_obj.attr('id');

        window_dict[window_id].data.replacements = {};

        if (data.timeline_group_id + '_' +
            parseFloat($('#threshold_input').val()) in session.result_cache) {
            window_dict[window_id].data.result_obj = session.result_cache[
                data.timeline_group_id + '_' + parseFloat($(
                    '#threshold_input').val())];

            if (!(metric in window_dict[window_id].data.result_obj)) {
                window_dict[window_id].data.flamegraph_obj = undefined;
                window_obj.find('.flamegraph_svg').hide();
                window_obj.find('.flamegraph_search').val('');
                window_obj.find('.no_flamegraph').show();
            } else {
                openFlameGraph(window_obj.attr('id'), metric);
            }

            loading_jquery.hide();
        } else {
            var pid_tid = data.timeline_group_id.split('_');

            $.ajax({
                url: window_dict[window_id].session + '/',
                method: 'POST',
                dataType: 'json',
                data: {pid: pid_tid[0], tid: pid_tid[1],
                       threshold: 1.0 * parseFloat($(
                           '#threshold_input').val()) / 100}
            }).done(ajax_obj => {
                session.result_cache[
                    data.timeline_group_id + '_' + parseFloat($(
                        '#threshold_input').val())] = ajax_obj;
                window_dict[window_id].data.result_obj = ajax_obj;

                if (!(metric in window_dict[window_id].data.result_obj)) {
                    window_dict[window_id].data.flamegraph_obj = undefined;
                    window_obj.find('.flamegraph_svg').hide();
                    window_obj.find('.flamegraph_search').val('');
                    window_obj.find('.no_flamegraph').show();
                } else {
                    openFlameGraph(window_obj.attr('id'), metric);
                }

                loading_jquery.hide();
            }).fail(ajax_obj => {
                window_dict[window_id].data.flamegraph_obj = undefined;
                window_obj.find('.flamegraph_svg').hide();
                window_obj.find('.flamegraph_search').val('');
                window_obj.find('.no_flamegraph').show();
                loading_jquery.hide();
            });
        }

        if (!existing_window) {
            new ResizeObserver(onWindowResize).observe(window_obj[0]);
        }
    } else if (type === 'roofline') {
        window_obj.find('.window_title').html(
            '[Session: ' + session.label + '] ' + 'Cache-aware roofline model');
        window_obj.find('.roofline_type_select').attr(
            'onchange', 'onRooflineTypeChange(event, ' +
                '\'' + window_obj.attr('id') + '\')');
        window_obj.find('.roofline_l1').attr(
            'onclick', 'onRooflineBoundsChange(\'l1\', \'' +
                window_obj.attr('id') + '\')');
        window_obj.find('.roofline_l2').attr(
            'onclick', 'onRooflineBoundsChange(\'l2\', \'' +
                window_obj.attr('id') + '\')');
        window_obj.find('.roofline_l3').attr(
            'onclick', 'onRooflineBoundsChange(\'l3\', \'' +
                window_obj.attr('id') + '\')');
        window_obj.find('.roofline_dram').attr(
            'onclick', 'onRooflineBoundsChange(\'dram\', \'' +
                window_obj.attr('id') + '\')');
        window_obj.find('.roofline_fp').attr(
            'onclick', 'onRooflineBoundsChange(\'fp\', \'' +
                window_obj.attr('id') + '\')');
        window_obj.find('.roofline_point_delete').attr(
            'onclick', 'onRooflinePointDeleteClick(event, ' +
                '\'' + window_obj.attr('id') + '\')');
        window_obj.find('.roofline_point_select').attr(
            'onchange', 'onRooflinePointChange(event, ' +
                '\'' + window_obj.attr('id') + '\')');

        if (type in session.result_cache) {
            window_dict[window_obj.attr('id')].data =
                session.result_cache[type];
            openRooflinePlot(window_obj,
                             session.result_cache[type]);
            loading_jquery.hide();
        } else {
            $.ajax({
                url: window_dict[window_id].session + '/',
                method: 'POST',
                dataType: 'json',
                data: {general_analysis: type}
            }).done(ajax_obj => {
                session.result_cache[type] = ajax_obj;
                window_dict[window_obj.attr('id')].data = ajax_obj;
                openRooflinePlot(window_obj, ajax_obj);
                loading_jquery.hide();
            }).fail(ajax_obj => {
                window.alert('Could not load the roofline model!');
                loading_jquery.hide();
                onWindowCloseClick(window_obj.attr('id'));
            });
        }
    } else if (type === 'code') {
        window_obj.find('.window_title').html(
            '[Session: ' + session.label + '] ' +
                'Code preview');
        for (const f of Object.keys(data.files_and_lines)) {
            window_obj.find('.code_file').append(
                new Option(f, f));
        }
        window_obj.find('.code_file').val(data.default_file);
        window_obj.find('.code_file').attr(
            'onchange', 'onCodeFileChange(\'' + window_obj.attr('id') + '\', event)');

        window_dict[window_obj.attr('id')].data.files_and_lines =
            structuredClone(data.files_and_lines);

        prepareCodePreview(window_obj, data.code,
                           data.files_and_lines[data.default_file])

        loading_jquery.hide();
    }
}

function prepareCodePreview(window_obj, code, lines) {
    window_obj.find('.code_container').scrollTop(0);
    var code_box = window_obj.find('.code_box');
    code_box.html('');

    for (const attr of code_box[0].attributes) {
        if (attr.name === 'class') {
            code_box.attr(attr.name, 'code_box');
        } else {
            code_box.attr(attr.name, '');
        }
    }

    code_box.text(code);
    window_obj.find('.code_copy_all').off('click');
    window_obj.find('.code_copy_all').on('click', {
        code: code
    }, function(event) {
        navigator.clipboard.writeText(event.data.code);
        window.alert('Code copied to clipboard!');
    });

    var line_to_go = undefined;

    hljs.highlightElement(window_obj.find('.code_box')[0]);
    hljs.lineNumbersBlockSync(window_obj.find('.code_box')[0]);

    var numf = new Intl.NumberFormat('en-US');

    for (const [line, how] of Object.entries(lines)) {
        var num_elem = window_obj.find('.hljs-ln-numbers[data-line-number="' + line + '"]');
        var line_elem = window_obj.find('.hljs-ln-code[data-line-number="' + line + '"]');

        num_elem.css('text-decoration', 'underline');
        num_elem.css('font-weight', 'bold');
        num_elem.css('cursor', 'help');

        if (how === 'exact') {
            num_elem.attr('title', 'Spawned by this line');
        } else {
            num_elem.attr('title', numf.format(how[4]) + ' ' +
                          how[5] + ' (' + (how[3] * 100).toFixed(2) + '%)');
        }

        var background_color = how === 'exact' ? 'lightgray' :
            'rgba(' + how[0] + ', ' + how[1] + ', ' + how[2] + ', ' + how[3] + ')';

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

        var container = window_obj.find('.code_container');
        container.scrollTop(window_obj.find(
            '.hljs-ln-numbers[data-line-number="' + line_to_go + '"]').offset().top -
                            container.offset().top);
    }
}

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
function openCode(data, default_path, session_id) {
    if (session_id === undefined) {
        session_id = $('#results_combobox').val();
    }

    var session = session_dict[session_id];
    var load = function(code) {
        var new_window = createWindowDOM('code',
                                         undefined, session_id);
        new_window.css('top', 'calc(50% - 275px)');
        new_window.css('left', 'calc(50% - 375px)');
        setupWindow(new_window, 'code', {
            code: code,
            files_and_lines: data,
            default_file: default_path,
        });
    };

    if (default_path in session.src_cache) {
        load(session.src_cache[default_path]);
    } else {
        $.ajax({
            url: session_id + '/',
            method: 'POST',
            dataType: 'text',
            data: {src: session.src_index_dict[default_path]}
        }).done(src_code => {
            session.src_cache[default_path] = src_code;
            load(src_code);
        }).fail(ajax_obj => {
            window.alert('Could not load ' + default_path + '!');
        });
    }
}

function onCodeFileChange(window_id, event) {
    var session = session_dict[window_dict[window_id].session];
    var path = event.currentTarget.value;
    var load = function(code) {
        var window_obj = $('#' + window_id);
        prepareCodePreview(window_obj, code,
                           window_dict[window_id].data.files_and_lines[path]);
    };

    if (path in session.src_cache) {
        load(session.src_cache[path]);
    } else {
        $.ajax({
            url: window_dict[window_id].session + '/',
            method: 'POST',
            dataType: 'text',
            data: {src: session.src_index_dict[path]}
        }).done(src_code => {
            session.src_cache[path] = src_code;
            load(src_code);
        }).fail(ajax_obj => {
            window.alert('Could not load ' + path + '!');
        });
    }
}

function openRooflinePlot(window_obj, roofline_obj) {
    var session = session_dict[
        window_dict[window_obj.attr('id')].session];

    for (var i = 0; i < roofline_obj.models.length; i++) {
        window_obj.find('.roofline_type_select').append(
            new Option(roofline_obj.models[i].isa, i));
    }

    for (const k of Object.keys(session.roofline_dict)) {
        window_obj.find('.roofline_point_select').append(
            new Option(k, k));
    }

    var plot_container = window_obj.find('.roofline');
    var plot_id = window_obj.attr('id') + '_roofline';
    plot_container.attr('id', plot_id);

    roofline_obj.bounds = {
        'l1': true,
        'l2': true,
        'l3': true,
        'dram': true,
        'fp': true
    };

    new ResizeObserver(onWindowResize).observe(window_obj[0]);
}

function onRooflinePointDeleteClick(event, window_id) {
    var window_obj = $('#' + window_id);
    var cur_val = window_obj.find('.roofline_point_select').val();

    if (cur_val !== '' && cur_val != undefined) {
        var confirmed = window.confirm('Are you sure you want to ' +
                                       'delete ' + cur_val + '? ' +
                                       'Click OK to confirm.');

        if (!confirmed) {
            return;
        }

        window_obj.find('.roofline_point_select').val('');
        window_obj.find('.roofline_point_ai').html('<i>Select first.</i>');
        window_obj.find('.roofline_point_perf').html('<i>Select first.</i>');
        window_obj.find(
            '.roofline_point_select option[value="' + cur_val + '"]').remove()

        var session = session_dict[window_dict[window_id].session];
        delete session.roofline_dict[cur_val];

        updateRoofline(window_obj, window_dict[window_id].data);
    }
}

function onRooflinePointChange(event, window_id) {
    var window_obj = $('#' + window_id);
    var new_val = event.target.value;

    if (new_val === '' || new_val == undefined) {
        window_obj.find('.roofline_point_ai').html('<i>Select first.</i>');
        window_obj.find('.roofline_point_perf').html('<i>Select first.</i>');
    } else {
        var session = session_dict[window_dict[window_id].session];
        var point = session.roofline_dict[new_val];

        window_obj.find('.roofline_point_ai').text(point[0]);
        window_obj.find('.roofline_point_perf').text(point[1] / 1000000000);
    }
}

function updateRoofline(window_obj, roofline_obj) {
    var plot_present = window_obj.find('.roofline_type_select').val() != null;
    var model = plot_present ?
        roofline_obj.models[
            window_obj.find('.roofline_type_select').val()] : undefined;
    var plot_data = [];
    var for_turning_x = [];

    if (roofline_obj.bounds.l1) {
        if (plot_present) {
            plot_data.push(roofline_obj.l1_func);
            for_turning_x.push(model.l1.gbps);
        }

        window_obj.find('.roofline_l1').html('<b>L1:</b> on');
    } else {
        window_obj.find('.roofline_l1').html('<b>L1:</b> off');
    }

    if (roofline_obj.bounds.l2) {
        if (plot_present) {
            plot_data.push(roofline_obj.l2_func);
            for_turning_x.push(model.l2.gbps);
        }

        window_obj.find('.roofline_l2').html('<b>L2:</b> on');
    } else {
        window_obj.find('.roofline_l2').html('<b>L2:</b> off');
    }

    if (roofline_obj.bounds.l3) {
        if (plot_present) {
            plot_data.push(roofline_obj.l3_func);
            for_turning_x.push(model.l3.gbps);
        }

        window_obj.find('.roofline_l3').html('<b>L3:</b> on');
    } else {
        window_obj.find('.roofline_l3').html('<b>L3:</b> off');
    }

    if (roofline_obj.bounds.dram) {
        if (plot_present) {
            plot_data.push(roofline_obj.dram_func);
            for_turning_x.push(model.dram.gbps);
        }

        window_obj.find('.roofline_dram').html('<b>DRAM:</b> on');
    } else {
        window_obj.find('.roofline_dram').html('<b>DRAM:</b> off');
    }

    if (roofline_obj.bounds.fp) {
        if (plot_present) {
            plot_data.push(roofline_obj.fp_func);
        }

        window_obj.find('.roofline_fp').html('<b>FP:</b> on');
    } else {
        window_obj.find('.roofline_fp').html('<b>FP:</b> off');
    }

    if (plot_present) {
        var turning_x = model.fp_fma.gflops / Math.min(...for_turning_x);

        var max_point_x = 0;
        var max_point_y = 0;

        var session = session_dict[window_dict[window_obj.attr('id')].session];

        for (const [name, [x, y]] of Object.entries(session.roofline_dict)) {
            var scaled_y = y / 1000000000;

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

        roofline_obj.plot_config.data = plot_data;
        roofline_obj.plot_config.xAxis.domain =
            [0.00390625, turning_x > max_point_x ? 1.5 * turning_x : 1.1 * max_point_x];
        roofline_obj.plot_config.yAxis.domain =
            [0.00390625, model.fp_fma.gflops > max_point_y ?
             1.25 * model.fp_fma.gflops : 1.1 * max_point_y];
        functionPlot(roofline_obj.plot_config);
    }
}

function onRooflineBoundsChange(bound, window_id) {
    var window_obj = $('#' + window_id);
    var roofline_obj = window_dict[window_id].data;
    roofline_obj.bounds[bound] = !roofline_obj.bounds[bound];

    updateRoofline(window_obj, roofline_obj);
}

function onRooflineTypeChange(event, window_id) {
    var window_obj = $('#' + window_id);
    var type_index = event.currentTarget.value;
    var roofline_obj = window_dict[window_id].data;
    var model = roofline_obj.models[type_index];
    var session = session_dict[window_dict[window_id].session];

    window_obj.find('.roofline_details_text').html(`
        <b>Precision:</b> ${model.precision}<br />
        <b>Threads:</b> ${model.threads}<br />
        <b>Loads:</b> ${model.loads}<br />
        <b>Stores:</b> ${model.stores}<br />
        <b>Interleaved:</b> ${model.interleaved}<br />
        <b>L1 bytes:</b> ${roofline_obj.l1}<br />
        <b>L2 bytes:</b> ${roofline_obj.l2}<br />
        <b>L3 bytes:</b> ${roofline_obj.l3}<br />
        <b>DRAM bytes:</b> ${model.dram_bytes}
    `);

    roofline_obj.l1_func = {
        fn: `min(x * ${model.l1.gbps}, ${model.fp_fma.gflops})`,
        color: 'darkred'
    };

    roofline_obj.l2_func = {
        fn: `min(x * ${model.l2.gbps}, ${model.fp_fma.gflops})`,
        color: 'darkgreen'
    };

    roofline_obj.l3_func = {
        fn: `min(x * ${model.l3.gbps}, ${model.fp_fma.gflops})`,
        color: 'darkblue'
    };

    roofline_obj.dram_func = {
        fn: `min(x * ${model.dram.gbps}, ${model.fp_fma.gflops})`,
        color: 'darkgrey'
    };

    roofline_obj.fp_func = {
        fn: model.fp.gflops,
        color: 'black',
        graphType: 'scatter',
        nSamples: 100
    }

    var plot_data = [];
    var for_turning_x = [];

    if (roofline_obj.bounds.l1) {
        plot_data.push(roofline_obj.l1_func);
        for_turning_x.push(model.l1.gbps);
    }

    if (roofline_obj.bounds.l2) {
        plot_data.push(roofline_obj.l2_func);
        for_turning_x.push(model.l2.gbps);
    }

    if (roofline_obj.bounds.l3) {
        plot_data.push(roofline_obj.l3_func);
        for_turning_x.push(model.l3.gbps);
    }

    if (roofline_obj.bounds.dram) {
        plot_data.push(roofline_obj.dram_func);
        for_turning_x.push(model.dram.gbps);
    }

    if (roofline_obj.bounds.fp) {
        plot_data.push(roofline_obj.fp_func);
    }

    var max_point_x = 0;
    var max_point_y = 0;

    for (const [name, [x, y]] of Object.entries(session.roofline_dict)) {
        var scaled_y = y / 1000000000;

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

    var turning_x = model.fp_fma.gflops / Math.min(...for_turning_x);

    var container = window_obj.find('.roofline');

    roofline_obj.plot_config = {
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

    functionPlot(roofline_obj.plot_config);
}

function onMenuItemClick(event, analysis_type, timeline_group_id) {
    closeAllMenus(event, true);

    var new_window = createWindowDOM(analysis_type, timeline_group_id);
    new_window.css('top', event.pageY + 'px');
    new_window.css('left', event.pageX + 'px');

    setupWindow(new_window, analysis_type, {
        timeline_group_id: timeline_group_id
    });
}

function changeFocus(window_id) {
    if (window_id === undefined) {
        var keys = Object.keys(window_dict);

        if (keys.length === 0) {
            return;
        }

        keys.sort(function comp(a, b) {
            return window_dict[b].last_focus - window_dict[a].last_focus;
        });
        window_id = keys[0];
    }

    if (!(window_id in window_dict)) {
        return;
    }

    var current_window = $('#' + window_id);
    var window_header = current_window.find('.window_header');

    if (current_focused_window_id !== window_id) {
        if (window_id !== undefined) {
            if (largest_z_index >= 10000) {
                var z_index_arr = [];

                for (const k of Object.keys(window_dict)) {
                    z_index_arr.push({'index': $('#' + k).css('z-index'),
                                      'id': k});
                }

                z_index_arr.sort((a, b) => {
                    if (a.index === undefined) {
                        return -1;
                    } else if (b.index === undefined) {
                        return 1;
                    } else {
                        return a.index - b.index;
                    }
                });

                var index = 1;
                for (const obj of z_index_arr) {
                    $('#' + obj.id).css('z-index', index);
                    index += 1;
                }

                current_window.css('z-index', index);
                largest_z_index = index;
            } else {
                largest_z_index += 1;
                current_window.css('z-index', largest_z_index);
            }

            window_header.css('background-color', 'black');
            window_header.css('color', 'white');
            window_header.css('fill', 'white');
        }

        for (const k of Object.keys(window_dict)) {
            if (k !== window_id) {
                var unfocused_window = $('#' + k);
                var unfocused_header = unfocused_window.find('.window_header');

                unfocused_header.css('background-color', 'lightgray');
                unfocused_header.css('color', 'black');
                unfocused_header.css('fill', 'black');
            }
        }

        current_focused_window_id = window_id;
        window_dict[window_id].last_focus = Date.now();
    }
}

function onWindowVisibilityClick(event, window_id) {
    windowStopPropagation(event);

    var current_window = $('#' + window_id);
    var window_entry = window_dict[window_id];
    var window_content = current_window.find('.window_content');
    var window_header = current_window.find('.window_header');

    if (!window_entry.collapsed) {
        window_entry.collapsed = true;
        window_entry.min_height = current_window.css('min-height');
        window_entry.last_height = current_window.outerHeight();
        current_window.css('min-height', '0');
        current_window.css('resize', 'horizontal');
        current_window.height(window_header.outerHeight());
    } else {
        window_entry.collapsed = false;
        current_window.height(window_entry.last_height);
        current_window.css('min-height', window_entry.min_height);
        current_window.css('resize', 'both');
        current_window.css('opacity', '');
    }
}

function updateFlameGraph(window_id, data, always_change_height) {
    var window_obj = $('#' + window_id);
    var flamegraph_obj = window_dict[window_id].data.flamegraph_obj;
    if (flamegraph_obj !== undefined) {
        var update_height = function() {
            var flamegraph_svg = window_obj.find('.flamegraph_svg').children()[0];

            if (flamegraph_svg !== undefined) {
                var target_height = flamegraph_svg.getBBox().height;

                if (always_change_height || target_height > window_obj.find('.flamegraph_svg').outerHeight()) {
                    window_obj.find('.flamegraph_svg').height(target_height);
                    flamegraph_svg.setAttribute('height', target_height);
                }
            }
        };

        if (data !== null) {
            flamegraph_total = data['value'];
            flamegraph_obj.update(data, update_height);
        } else {
            update_height();
        }
    }
}

function onOpenCodeClick(event) {
    var data = event.data.data;
    var node = data.node;
    var offset_dict = data.offset_dict;
    var session_id = data.session;
    var sums = {};

    for (const [addr, val] of Object.entries(node.data.offsets)) {
        var decoded = offset_dict[addr];

        if (decoded === undefined) {
            continue;
        }

        if (!(decoded.file in sums)) {
            sums[decoded['file']] = {};
        }

        if (!(decoded.line in sums[decoded.file])) {
            if (node.data.cold) {
                sums[decoded.file][decoded.line] = [170, 170, 255, 0, 0, 'unit(s)'];
            } else {
                sums[decoded.file][decoded.line] = [255, 0, 0, 0, 0, 'unit(s)'];
            }
        }

        sums[decoded.file][decoded.line][3] += (val / node.data.value);
        sums[decoded.file][decoded.line][4] += val;
    }

    openCode(sums, Object.keys(sums)[0], session_id);
}

function onAddToRooflineClick(event) {
    var window_id = event.data.data.window_id;
    var session = session_dict[window_dict[window_id].session];
    var info = session.roofline_info;
    var result_obj = window_dict[window_id].data.result_obj;
    var window_obj = $('#' + window_id);
    var exists = false;

    do {
        var name = window.prompt((exists ? 'This name already exists!\n\n' : '') +
            'What name do you want to give to your new roofline point?');

        if (name == undefined || name === "") {
            return;
        }

        exists = name in session.roofline_dict;
    } while (exists);

    var trace = [];
    var node = event.data.data.node;
    var cur_callchain_obj = session.callchain_obj[window_obj.find('.flamegraph_metric').val()];

    while (node != undefined) {
        if (node.data.name in cur_callchain_obj) {
            trace.push(cur_callchain_obj[node.data.name]);
        } else {
            trace.push(node.data.name);
        }
        node = node.parent;
    }

    var ai_keys = info.ai_keys;
    var instr_keys = info.instr_keys;

    var ai_nodes = [];
    var instr_nodes = [];

    for (const k of ai_keys) {
        if (result_obj[k] === undefined) {
            ai_nodes.push([undefined]);
        } else {
            ai_nodes.push([result_obj[k][0],
                           session.callchain_obj[k]]);
        }
    }

    for (const k of instr_keys) {
        if (result_obj[k] === undefined) {
            instr_nodes.push([undefined]);
        } else {
            instr_nodes.push([result_obj[k][0],
                              session.callchain_obj[k]]);
        }
    }

    var walltime_node = [[result_obj['walltime'][0],
                          session.callchain_obj['walltime']]];

    var iterate = function(arr, req_name) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i][0] === undefined) {
                continue;
            }

            var found = false;
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

    for (var i = trace.length - 2; i >= 0; i--) {
        iterate(ai_nodes, trace[i]);
        iterate(instr_nodes, trace[i]);
        iterate(walltime_node, trace[i]);
    }

    var zeroed_instr_nodes = 0;
    var zeroed_ai_nodes = 0;

    for (var i = 0; i < instr_nodes.length; i++) {
        if (instr_nodes[i][0] === undefined) {
            instr_nodes[i] = 0;
            zeroed_instr_nodes++;
        } else {
            instr_nodes[i] = instr_nodes[i][0].value;
        }
    }

    for (var i = 0; i < ai_nodes.length; i++) {
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

    var flop = undefined;
    var flops = undefined;
    var arith_intensity = undefined;

    if (info.cpu_type === 'Intel_x86') {
        flop = instr_nodes[0] + instr_nodes[1] + 4 * instr_nodes[2] +
            2 * instr_nodes[3] + 8 * instr_nodes[4] + 4 * instr_nodes[5] +
            16 * instr_nodes[6] + 8 * instr_nodes[7];
        flops = flop / (walltime_node[0][0].value / 1000000000);

        var instr_sum = instr_nodes[0] + instr_nodes[1] + instr_nodes[2] +
            instr_nodes[3] + instr_nodes[4] + instr_nodes[5] + instr_nodes[6] +
            instr_nodes[7];

        var single_ratio =
            (instr_nodes[0] + instr_nodes[2] +
             instr_nodes[4] + instr_nodes[6]) / instr_sum;
        var double_ratio =
            (instr_nodes[1] + instr_nodes[3] +
             instr_nodes[5] + instr_nodes[7]) / instr_sum;
        arith_intensity = flop / (ai_nodes[0] * (4 * single_ratio +
                                                 8 * double_ratio));

        // var single_scalar_ratio = instr_nodes[0] / instr_sum;
        // var double_scalar_ratio = instr_nodes[1] / instr_sum;
        // var sse_ratio = (instr_nodes[2] + instr_nodes[3]) / instr_sum;
        // var avx2_ratio = (instr_nodes[4] + instr_nodes[5]) / instr_sum;
        // var avx512_ratio = (instr_nodes[6] + instr_nodes[7]) / instr_sum;

        // arith_intensity = flop / (ai_nodes[0] * (
        //     4 * single_scalar_ratio + 8 * double_scalar_ratio +
        //         16 * sse_ratio + 32 * avx2_ratio + 64 * avx512_ratio))
    } else if (info.cpu_type === 'AMD_x86') {
        flop = instr_nodes[0] + instr_nodes[1] + instr_nodes[2] +
            instr_nodes[3] + instr_nodes[4] + instr_nodes[5] +
            instr_nodes[6] + instr_nodes[7];
        flops = flop / (walltime_node[0][0].value / 1000000000);

        var single_ratio =
            (instr_nodes[0] + instr_nodes[2] +
             instr_nodes[4] + instr_nodes[6]) / instr_sum;
        var double_ratio =
            (instr_nodes[1] + instr_nodes[3] +
             instr_nodes[5] + instr_nodes[7]) / instr_sum;
        arith_intensity = flop / ((ai_nodes[0] + ai_nodes[1]) *
                                  (4 * single_ratio +
                                   8 * double_ratio));
    }

    session.roofline_dict[name] = [arith_intensity, flops];

    for (const [k, v] of Object.entries(window_dict)) {
        if (v.type === 'roofline' &&
            v.session === window_dict[window_id].session) {
            var window_obj = $('#' + k);
            window_obj.find('.roofline_point_select').append(
                new Option(name, name));
            updateRoofline(window_obj, v.data);
        }
    }
}

function openFlameGraph(window_id, metric) {
    var window_obj = $('#' + window_id);
    var result_obj = window_dict[window_id].data.result_obj;
    window_dict[window_id].data.flamegraph_obj = flamegraph();
    var flamegraph_obj = window_dict[window_id].data.flamegraph_obj;
    flamegraph_obj.inverted(true);
    flamegraph_obj.sort(window_obj.find('.flamegraph_time_ordered').prop('checked') ? false : true);
    flamegraph_obj.color(function(node, original_color) {
        if (node.highlight) {
            return original_color;
        } else if (node.data.cold) {
            return '#039dfc';
        } else if (node.data.name === "(compressed)") {
            return '#cc99ff';
        } else {
            return original_color;
        }
    });
    flamegraph_obj.getName(function(node) {
        var session = session_dict[window_dict[window_id].session];
        var result = undefined;
        if (node.data.name in session.callchain_obj[window_obj.find('.flamegraph_metric').val()]) {
            var symbol = session.callchain_obj[window_obj.find('.flamegraph_metric').val()][node.data.name];
            result = new String(getSymbolFromMap(symbol[0], symbol[1], window_id));
        } else {
            result = new String(node.data.name);
        }

        for (const [k, v] of Object.entries(
            window_dict[window_id].data.replacements)) {
            result = result.replace(new RegExp(k), v);
        }

        return result;
    });
    flamegraph_obj.onClick(function(node) {
        if ("hidden_children" in node.data) {
            var parent = node.parent.data;
            var new_children = [];

            for (var i = 0; i < parent.children.length; i++) {
                if ("compressed_id" in parent.children[i] &&
                    parent.children[i].compressed_id === node.data.compressed_id) {
                    for (var j = 0; j < node.data.hidden_children.length; j++) {
                        new_children.push(node.data.hidden_children[j]);
                    }
                } else {
                    new_children.push(parent.children[i]);
                }
            }

            parent.children = new_children;
            updateFlameGraph(window_id, d3.select('#' + window_obj.find('.flamegraph_svg').attr('id')).datum().data, false);
        }
    });
    flamegraph_obj.onContextMenu(function(event, node) {
        closeAllMenus(event, false);

        var options = [];
        var session = session_dict[window_dict[window_id].session];

        if (!window_obj.find('.flamegraph_time_ordered').prop('checked') &&
            'roofline' in session.general_metrics_dict) {
            options.push(['Add to the roofline plot', [{
                'node': node,
                'window_id': window_id
            }, onAddToRooflineClick]]);
        }

        var symbol = session.callchain_obj[window_obj.find('.flamegraph_metric').val()][node.data.name];

        if (symbol !== undefined && session.src_dict[symbol[1]] !== undefined) {
            var offset_dict = session.src_dict[symbol[1]];
            var code_available = false;

            for (const addr of Object.keys(node.data.offsets)) {
                var decoded = offset_dict[addr];

                if (decoded !== undefined) {
                    code_available = true;
                    break;
                }
            }

            if (code_available) {
                options.push(['View the code details', [{
                    'offset_dict': offset_dict,
                    'node': node,
                    'session': window_dict[window_id].session
                }, onOpenCodeClick]]);
            }
        }

        if (options.length === 0) {
            return;
        }

        var menu = createMenuDOM(options);

        menu.css('top', event.pageY);
        menu.css('left', event.pageX);
        menu.outerHeight('auto');
        menu.css('display', 'flex');
        menu.css('z-index', '10001');

        var height = menu.outerHeight();
        var width = menu.outerWidth();

        if (event.pageY + height > $(window).outerHeight() - 30) {
            menu.outerHeight($(window).outerHeight() - event.pageY - 30);
        }

        if (event.pageX + width > $(window).outerWidth() - 20) {
            menu.css('left', Math.max(0, event.pageX - width));
        }

        $('body').append(menu);
    });
    flamegraph_obj.setLabelHandler(function(node) {
        var numf = new Intl.NumberFormat('en-US');
        var getName = window_dict[window_id].data.flamegraph_obj.getName();
        return getName(node) + ' (' + numf.format(node.data.value) +
            ' unit(s), ' + (100 * (node.x1 - node.x0)).toFixed(2) + '%)';
    });
    flamegraph_obj.setSearchHandler(function(results, sum, total) {
        window_obj.find('.flamegraph_search_blocks').html(results.length.toLocaleString());
        window_obj.find('.flamegraph_search_found').html(sum.toLocaleString());
        window_obj.find('.flamegraph_search_total').html(window_dict[window_id].data.total.toLocaleString());
        window_obj.find('.flamegraph_search_percentage').html(
            (1.0 * sum / window_dict[window_id].data.total * 100).toFixed(2));
    });

    if (metric === 'walltime') {
        flamegraph_obj.setColorHue('warm');
    } else {
        flamegraph_obj.setColorHue('green');
    }

    window_obj.find('.no_flamegraph').hide();
    window_obj.find('.flamegraph_svg').html('');
    window_obj.find('.flamegraph_search').val('');
    window_obj.find('.flamegraph_search_results').hide();
    window_obj.find('.flamegraph_svg').attr(
        'id', window_obj.attr('id') + '_flamegraph_svg');
    window_obj.find('.flamegraph_svg').show();
    flamegraph_obj.width(window_obj.find('.flamegraph').outerWidth());
    d3.select('#' + window_obj.find('.flamegraph_svg').attr('id')).datum(structuredClone(
        result_obj[metric][
            window_obj.find('.flamegraph_time_ordered').prop('checked') ? 1 : 0])).call(
                flamegraph_obj);
    window_dict[window_id].data.total =
        d3.select('#' + window_obj.find('.flamegraph_svg').attr('id')).datum().data['value'];
    updateFlameGraph(window_id, null, true);
    flamegraph_obj.width(window_obj.find('.flamegraph_svg').outerWidth());
    flamegraph_obj.update();

    window_obj.find('.flamegraph')[0].scrollTop = 0;
}

function closeAllMenus(event, include_target, exclude) {
    if (exclude !== 'thread_menu_block' &&
        (event === undefined || include_target ||
         !document.getElementById('thread_menu_block').contains(event.target))) {
        $('#thread_menu_block').hide();
    }

    if (exclude !== 'settings_block' &&
        (event === undefined || include_target ||
         !document.getElementById('settings_block').contains(event.target))) {
        $('#settings_block').hide();
    }

    if (exclude !== 'general_analysis_menu_block' &&
        (event === undefined || include_target ||
         !document.getElementById('general_analysis_menu_block').contains(event.target))) {
        $('#general_analysis_menu_block').hide();
    }

    if (exclude !== 'custom_menu' && document.getElementById('custom_menu') != undefined &&
        (event === undefined || include_target ||
         !document.getElementById('custom_menu').contains(event.target))) {
        $('#custom_menu').remove();
    }
}

function windowStopPropagation(event) {
    event.stopPropagation();
    event.preventDefault();
}

function onWindowCloseClick(window_id) {
    $('#' + window_id).remove();
    delete window_dict[window_id];
    changeFocus();
}

function onWindowRefreshClick(event, window_id) {
    windowStopPropagation(event);

    var window_dict_obj = window_dict[window_id];

    if (window_dict_obj.type === 'flame_graphs') {
        window_dict_obj.setup_data.metric =
            $('#' + window_id).find('.flamegraph_metric').val();
        window_dict_obj.setup_data.time_ordered =
            $('#' + window_id).find('.flamegraph_time_ordered').prop('checked');
    }

    $('#' + window_id).find('.window_content').html(
        type_dict[window_dict_obj.type]);
    window_dict_obj.data = {}
    setupWindow($('#' + window_id),
                window_dict_obj.type);
}

function onFlameGraphReplaceClick(window_id) {
    var query = window.prompt(
        'Please enter a regular expression to be replaced in ' +
            'the flame graph.',
        $('#' + window_id).find('.flamegraph_search').val());

    if (query == undefined || query === "") {
        return;
    }

    var replacement = window.prompt(
        'Please enter what you want to replace your query with. ' +
            'You can use the syntax from https://developer.mozilla.org/' +
            'en-US/docs/Web/JavaScript/Reference/Global_Objects/String/' +
            'replace#specifying_a_string_as_the_replacement.');

    if (replacement == undefined) {
        return;
    }

    window_dict[window_id].data.replacements[query] = replacement;
    window_dict[window_id].data.flamegraph_obj.update();
}

function onFlameGraphReplaceRightClick(event, window_id) {
    windowStopPropagation(event);

    var options = [];

    for (const [k, v] of Object.entries(
        window_dict[window_id].data.replacements)) {
        options.push([k + ' ==> ' + v, [{'window_id': window_id,
                           'query': k, 'replacement': v},
                          onReplacementClick]]);
    }

    if (options.length === 0) {
        return;
    }

    var menu = createMenuDOM(options);

    menu.css('top', event.pageY);
    menu.css('left', event.pageX);
    menu.outerHeight('auto');
    menu.css('display', 'flex');
    menu.css('z-index', '10001');

    var height = menu.outerHeight();
    var width = menu.outerWidth();

    if (event.pageY + height > $(window).outerHeight() - 30) {
        menu.outerHeight($(window).outerHeight() - event.pageY - 30);
    }

    if (event.pageX + width > $(window).outerWidth() - 20) {
        menu.css('left', Math.max(0, event.pageX - width));
    }

    $('body').append(menu);
}

function onReplacementClick(info) {
    var data = info.data.data;

    var replacements = window_dict[data.window_id].data.replacements;

    var query = window.prompt(
        'Please enter a regular expression to be replaced in ' +
            'the flame graph. To remove the replacement, put ' +
            'an empty text here.', data.query);

    if (query == undefined) {
        return;
    }

    if (query === "") {
        delete replacements[data.query];
        window.alert('The replacement has been removed!');
        window_dict[data.window_id].data.flamegraph_obj.update();
        return;
    }

    var replacement = window.prompt(
        'Please enter what you want to replace your query with. ' +
            'You can use the syntax from https://developer.mozilla.org/' +
            'en-US/docs/Web/JavaScript/Reference/Global_Objects/String/' +
            'replace#specifying_a_string_as_the_replacement.',
        data.replacement);

    if (replacement == undefined) {
        return;
    }

    window_dict[data.window_id].data.replacements[query] = replacement;
    window_dict[data.window_id].data.flamegraph_obj.update();
}

function onMetricChange(window_id, event) {
    var window_obj = $('#' + window_id);
    var result_obj = window_dict[window_id].data.result_obj;
    var metric = event.currentTarget.value;

    window_dict[window_id].data.flamegraph_obj = undefined;
    window_obj.find('.flamegraph_time_ordered').prop('checked', false);

    if (metric in result_obj) {
        openFlameGraph(window_id, metric);
    } else {
        window_obj.find('.flamegraph_search').val('');
        window_obj.find('.flamegraph_search_results').hide();
        window_obj.find('.flamegraph_svg').hide();
        window_obj.find('.no_flamegraph').show();
    }
}

function onTimeOrderedChange(window_id, event) {
    var window_obj = $('#' + window_id);
    var flamegraph_obj = window_dict[window_id].data.flamegraph_obj;
    var result_obj = window_dict[window_id].data.result_obj;
    if (flamegraph_obj !== undefined) {
        flamegraph_obj.sort(!event.currentTarget.checked);
        updateFlameGraph(window_id, structuredClone(
            result_obj[window_obj.find('.flamegraph_metric').val()][
                event.currentTarget.checked ? 1 : 0]), true);

        window_obj.find('.flamegraph_search').val('');
        window_obj.find('.flamegraph_search_results').hide();
    }
}

function onSearchQueryChange(window_id, value) {
    var window_obj = $('#' + window_id);
    var flamegraph_obj = window_dict[window_id].data.flamegraph_obj;
    if (flamegraph_obj !== undefined) {
        if (value === undefined || value === "") {
            window_obj.find('.flamegraph_search_results').hide();
        } else {
            window_obj.find('.flamegraph_search_results').show();
        }

        flamegraph_obj.search(value);
    }
}

function onWindowMouseUp(window_id) {
    var window_obj = $('#' + window_id);
    if (window_dict[window_id].being_resized) {
        if (window_dict[window_id].type === 'flame_graphs') {
            var flamegraph_obj = window_dict[window_id].data.flamegraph_obj;
            flamegraph_obj.width(window_obj.find('.flamegraph_svg').outerWidth());
            flamegraph_obj.update();
        } else if (window_dict[window_id].type === 'roofline' &&
                   window_dict[window_id].data.plot_config !== undefined &&
                   window_obj.find('.roofline_type_select').val() != null) {
            window_obj.find('.roofline').html('');

            var plot_config = window_dict[window_id].data.plot_config;
            plot_config.width = window_obj.find('.roofline').outerWidth() - 10;
            plot_config.height = window_obj.find('.roofline').outerHeight() - 10;
            functionPlot(plot_config);
        }
        window_dict[window_id].being_resized = false;
    }
}

function onWindowResize(windows) {
    for (var window of windows) {
        var target = window.target;

        if (target === null) {
            continue;
        }

        var window_id = $(target).attr('id');
        while (target !== null && !(window_id in window_dict)) {
            target = target.parentElement;
            window_id = $(target).attr('id');
        }

        if (target === null) {
            continue;
        }

        if (window_dict[window_id].data.flamegraph_obj !== undefined) {
            window_dict[window_id].being_resized = true;
        } else if (window_dict[window_id].type === 'roofline') {
            window_dict[window_id].being_resized = true;
            $(target).find('.roofline').html('');
        }
    }
}

// downloadFlameGraph() is based on https://stackoverflow.com/a/28226736
// (originally CC BY-SA 4.0, covered by GNU GPL v3 here)
function downloadFlameGraph(window_id) {
    var window_obj = $('#' + window_id);
    var flamegraph_obj = window_dict[window_id].data.flamegraph_obj;

    if (flamegraph_obj === undefined) {
        return;
    }

    var filename = window.prompt(
        'What filename do you want? ' +
            '(".png" will be added automatically)');

    if (filename == undefined || filename === "") {
        return;
    }

    var svg = window_obj.find('.flamegraph_svg').children()[0].cloneNode(true);
    var style = document.createElement('style');

    style.innerHTML = $('#viewer_script').attr('data-d3-flamegraph-css');

    svg.insertBefore(style, svg.firstChild);

    var url = URL.createObjectURL(new Blob(
        [(new XMLSerializer()).serializeToString(svg)],
        { type: 'image/svg+xml;charset=utf-8' }));

    var image = new Image();
    image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);

        URL.revokeObjectURL(url);

        var a = document.createElement('a');
        a.download = filename;
        a.target = '_blank';
        a.href = canvas.toDataURL('image/png');
        a.addEventListener('click', function(event) {
            event.stopPropagation();
        });
        a.click();
    };
    image.onerror = function() {
        window.alert("Could not download the flame graph because " +
                     "of an error!");
    };
    image.width = svg.width.baseVal.value;
    image.height = svg.height.baseVal.value;
    image.src = url;
}

function checkValidPercentage(event) {
    var input = event.target;

    if (input.value === '' || input.value === undefined) {
        input.value = '0';
    } else {
        var number = parseFloat(input.value);

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
    var number = parseFloat(input.value);

    if (isNaN(number)) {
        input.value = '0';
    } else {
        input.value = number;
    }
}

function startDrag(event, window_id) {
    windowStopPropagation(event);
    changeFocus(window_id);

    var dragged = document.getElementById(window_id);
    var startX = event.offsetX;
    var startY = event.offsetY;

    $('body').mousemove(function(event) {
        event.stopPropagation();
        event.preventDefault();
        var newX = event.pageX - startX;
        var newY = event.pageY - startY;
        var dragged_rect = dragged.getBoundingClientRect();

        dragged.style.left = newX + 'px';
        dragged.style.top = newY + 'px';
    });

    $('body').mouseup(function(event) {
        $('body').off('mousemove');
        $('body').off('mouseup');
    });
}

function onSettingsClick(event) {
    $('#settings_block').css('top', event.clientY);
    $('#settings_block').css('left', event.clientX);
    $('#settings_block').css('z-index', '10001');
    $('#settings_block').show();

    var width = $('#settings_block').outerWidth();

    if (event.clientX + width > $(window).outerWidth() - 20) {
        $('#settings_block').css(
            'left', Math.max(0, event.clientX - width));
    }

    event.preventDefault();
    event.stopPropagation();

    closeAllMenus(event, false, 'settings_block');
}

function onGeneralAnalysesClick(event) {
    var session = session_dict[$('#results_combobox').val()];
    var metrics_dict = session.general_metrics_dict;
    $('#general_analysis_menu_items').empty();

    for (const [k, v] of Object.entries(metrics_dict)) {
        $(`<div class="menu_item"
            onclick="onMenuItemClick(event, '${k}')">
             ${v.title}
           </div>`).appendTo('#general_analysis_menu_items');
    }

    $('#general_analysis_menu_block').css('top', event.clientY);
    $('#general_analysis_menu_block').css('left', event.clientX);
    $('#general_analysis_menu_block').outerHeight('auto');
    $('#general_analysis_menu_block').css('display', 'flex');
    $('#general_analysis_menu_block').css('z-index', '10001');

    var width = $('#general_analysis_menu_block').outerWidth();

    if (event.clientX + width > $(window).outerWidth() - 20) {
        $('#general_analysis_menu_block').css(
            'left', Math.max(0, event.clientX - width));
    }

    event.preventDefault();
    event.stopPropagation();

    closeAllMenus(event, false, 'general_analysis_menu_block');
}
