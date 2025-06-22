// SPDX-FileCopyrightText: 2025 CERN
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Adaptyst Analyser: a tool for analysing performance analysis results

function stopPropagation(event) {
    event.stopPropagation();
    event.preventDefault();
}

class Session {
    static instances = {};

    constructor(id, label) {
        this.id = id;
        this.label = label;
        this.node_data = {};
        Session.instances[id] = this;
    }
}

class Window {
    static instances = {};
    static current_focused_id = undefined;
    static largest_z_index = 0;

    static changeFocus(window_id) {
        if (window_id === undefined) {
            let keys = Object.keys(Window.instances);

            if (keys.length === 0) {
                return;
            }

            keys.sort(function comp(a, b) {
                return Window.instances[b].last_focus - Window.instances[a].last_focus;
            });
            window_id = keys[0];
        }

        if (!(window_id in Window.instances)) {
            return;
        }

        let window = Window.instances[window_id];
        let window_header = window.dom.find('.window_header');

        if (Window.current_focused_id !== window_id) {
            if (Window.largest_z_index >= 10000) {
                let z_index_arr = [];

                for (const w of Object.values(Window.instances)) {
                    z_index_arr.push({'index': w.dom.css('z-index'),
                                      'id': w.id});
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

                let index = 1;
                for (const obj of z_index_arr) {
                    $('#' + obj.id).css('z-index', index);
                    index += 1;
                }

                window.dom.css('z-index', index);
                Window.largest_z_index = index;
            } else {
                Window.largest_z_index += 1;
                window.dom.css('z-index', Window.largest_z_index);
            }

            window_header.css('background-color', 'black');
            window_header.css('color', 'white');
            window_header.css('fill', 'white');

            for (const w of Object.values(Window.instances)) {
                if (w.id !== window_id) {
                    let unfocused_window = w.dom;
                    let unfocused_header = unfocused_window.find('.window_header');

                    unfocused_header.css('background-color', 'lightgray');
                    unfocused_header.css('color', 'black');
                    unfocused_header.css('fill', 'black');
                }
            }

            Window.current_focused_id = window_id;
            Window.instances[window_id].last_focus = Date.now();
        }
    }

    static onResize(windows) {
        for (const window of windows) {
            let target = window.target;

            if (target === null) {
                continue;
            }

            let window_id = $(target).attr('id');
            while (target !== null && !(window_id in Window.instances)) {
                target = target.parentElement;
                window_id = $(target).attr('id');
            }

            if (target === null) {
                continue;
            }

            if (Window.instances[window_id].first_resize_call) {
                Window.instances[window_id].first_resize_call = false;
            } else {
                let position = $(target).position();

                target.style.transform = '';
                target.style.top = position.top + 'px';
                target.style.left = position.left + 'px';

                Window.instances[window_id].startResize();
            }
        }
    }

    constructor(parent, session, node_id, data, x, y) {
        let index = 0;
        let id = undefined;

        if (session == undefined) {
            id = `w_${this.getType()}_${index}`;

            while (id in Window.instances) {
                index++;
                id = `w_${this.getType()}_${index}`;
            }
        } else {
            id = `w_${session.label}_${this.getType()}_${index}`;

            while (id in Window.instances) {
                index++;
                id = `w_${session.label}_${this.getType()}_${index}`;
            }
        }

        Window.instances[id] = this;

        this.id = id;
        this.session = session;
        this.node_id = node_id;
        this.data = {};
        this.being_resized = false;
        this.collapsed = false;
        this.last_focus = Date.now();
        this.dom = this.createWindowDOM();

        if (x !== undefined && y !== undefined) {
            this.dom.css('left', x + 'px');
            this.dom.css('top', y + 'px');
        } else {
            this.dom.css('top', '50%');
            this.dom.css('left', '50%');
            this.dom.css('transform', 'translate(-50%, -50%)');
        }

        this.first_resize_call = true;
        new ResizeObserver(Window.onResize).observe(this.dom[0]);

        this.setup(parent, data);
    }

    getType() {
        // Can be implemented by Window's children
    }

    getContentCode() {
        // Can be implemented by Window's children
    }

    createWindowDOM() {
        const window_header = `
<div class="window_header">
  <span class="window_title"></span>
  <!-- This SVG is from Google Material Icons, originally licensed under
       Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
       (covered by GNU GPL v3 here) -->
  <svg xmlns="http://www.w3.org/2000/svg" class="window_refresh" height="24px"
       viewBox="0 -960 960 960" width="24px" onmousedown="stopPropagation(event)">
    <title>Reset window contents</title>
    <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100
             70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
  </svg>
  <!-- This SVG is from Google Material Icons, originally licensed under
       Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
       (covered by GNU GPL v3 here) -->
  <svg xmlns="http://www.w3.org/2000/svg" class="window_visibility" height="24px"
       viewBox="0 -960 960 960" width="24px" onmousedown="stopPropagation(event)">
    <title>Toggle visibility</title>
    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45
             31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54
             137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/>
  </svg>
  <!-- This SVG is from Google Material Icons, originally licensed under
       Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
       (covered by GNU GPL v3 here) -->
  <svg xmlns="http://www.w3.org/2000/svg" class="window_close" height="24px"
       viewBox="0 -960 960 960" width="24px" onmousedown="stopPropagation(event)">
    <title>Close</title>
    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
  </svg>
</div>
`;

        let root = $('<div></div>');
        root.attr('class', 'window ' + this.getType() + '_window');
        root.append($(window_header));

        let content = $('<div></div>');
        content.attr('class', 'window_content ' + this.getType() + '_content');
        content.html(this.getContentCode());

        root.append(content);

        root.attr('id', this.id);
        root.attr('onclick', `Window.instances['${this.id}'].focus()`);
        root.attr('onmouseup', `Window.instances['${this.id}'].onMouseUp()`);
        root.find('.window_header').attr('onmousedown', `Window.instances['${this.id}'].startDrag(event)`);
        root.find('.window_refresh').attr(
            'onclick', `Window.instances['${this.id}'].onRefreshClick(event)`);
        root.find('.window_visibility').attr(
            'onclick', `Window.instances['${this.id}'].onVisibilityClick(event)`);
        root.find('.window_close').attr(
            'onclick', `Window.instances['${this.id}'].close(event)`);

        return root;
    }

    focus() {
        Window.changeFocus(this.id);
    }

    onMouseUp() {
        if (this.being_resized) {
            this.finishResize();
            this.being_resized = false;
        }
    }

    startResize() {
        // Can be implemented by Window's children
    }

    finishResize() {
        // Can be implemented by Window's children
    }

    startDrag(event) {
        stopPropagation(event);
        this.focus();

        let dragged = document.getElementById(this.id);
        let startX = event.offsetX;
        let startY = event.offsetY;

        $('body').mousemove(function(event) {
            event.stopPropagation();
            event.preventDefault();
            let newX = event.pageX - startX;
            let newY = event.pageY - startY;
            let dragged_rect = dragged.getBoundingClientRect();

            dragged.style.transform = '';
            dragged.style.left = newX + 'px';
            dragged.style.top = newY + 'px';
        });

        $('body').mouseup(function(event) {
            $('body').off('mousemove');
            $('body').off('mouseup');
        });
    }

    onRefreshClick(event) {
        stopPropagation(event);

        this.prepareRefresh();

        this.dom.find('.window_content').html(this.getContentCode());
        this.data = {}
        this.setup();
    }

    prepareRefresh() {
        // Can be implemented by Window's children
    }

    prepareClose() {
        // Can be implemented by Window's children
    }

    showLoading() {
        this.loading_jquery = $('#loading').clone();
        this.loading_jquery.removeAttr('id');
        this.loading_jquery.attr('class', 'loading');
        this.loading_jquery.prependTo(this.dom.find('.window_content'));
        this.loading_jquery.show();
    }

    hideLoading() {
        this.loading_jquery.hide();
    }

    setup(parent, data) {
        let existing_window = false;

        if (data === undefined) {
            data = this.setup_data;
            existing_window = true;
        }

        if (this.session === undefined) {
            this.dom.find('.window_title').html(this.getTitle());
        } else {
            this.dom.find('.window_title').html(
                '[Session: ' + this.session.label + '] ' +
                    this.getTitle());
        }

        this.showLoading();

        if (!existing_window) {
            this.dom.appendTo(parent);
            this.focus();
        }

        this.setup_data = data;
        this._setup(data, existing_window);
    }

    getTitle() {
        // Can be implemented by Window's children
    }

    _setup(data, existing_window) {
        // Can be implemented by Window's children
    }

    close(event) {
        stopPropagation(event);

        this.prepareClose();

        this.dom.remove();
        delete Window.instances[this.id];
        Window.changeFocus();
    }

    getNodeData() {
        if (this.session === undefined) {
            return undefined;
        }

        return this.session.node_data[this.node_id];
    }

    onVisibilityClick(event) {
        stopPropagation(event);

        let window_content = this.dom.find('.window_content');
        let window_header = this.dom.find('.window_header');

        if (!this.collapsed) {
            let position = this.dom.position();

            this.dom.css('transform', '');
            this.dom.css('left', position.left);
            this.dom.css('top', position.top);

            this.collapsed = true;
            this.min_height = this.dom.css('min-height');
            this.last_height = this.dom.outerHeight();
            this.dom.css('min-height', '0');
            this.dom.css('resize', 'horizontal');
            this.dom.height(window_header.outerHeight());
        } else {
            this.collapsed = false;
            this.dom.height(this.last_height);
            this.dom.css('min-height', this.min_height);
            this.dom.css('resize', 'both');
            this.dom.css('opacity', '');
        }
    }
}

class Menu {
    static createMenu(x, y, options) {
        let menu = $('<div id="menu" class="menu_block"></div>');
        let first = true;

        for (const [k, v] of options) {
            let item = $('<div></div>');

            if (first) {
                item.addClass('menu_item_first');
                first = false;
            } else {
                item.addClass('menu_item');
            }

            item.addClass('menu_item_with_hover');

            item.on('click', {
                'data': v[0],
                'handler': v[1]
            }, event => {
                stopPropagation(event);
                Menu.closeMenu();

                if (event.data.handler !== undefined) {
                    event.data.handler(event);
                }
            });

            item.text(k);
            menu.append(item);
        }

        menu.css('top', y);
        menu.css('left', x);
        menu.outerHeight('auto');
        menu.css('display', 'flex');
        menu.css('z-index', '10001');

        let height = menu.outerHeight();
        let width = menu.outerWidth();

        if (y + height > $(window).outerHeight() - 30) {
            menu.outerHeight($(window).outerHeight() - y - 30);
        }

        if (x + width > $(window).outerWidth() - 20) {
            menu.css('left', Math.max(0, x - width));
        }

        Menu.closeMenu();
        $('body').append(menu);
    }

    static createMenuWithCustomBlocks(x, y, blocks) {
        Menu.closeMenu();

        let menu = $('<div id="menu" class="menu_block"></div>');
        let first = true;

        for (const v of blocks) {
            if (first) {
                v.item.addClass('menu_item_first');
                first = false;
            } else {
                v.item.addClass('menu_item');
            }

            if ('hover' in v && v.hover) {
                v.item.addClass('menu_item_with_hover');
            }

            if (v.click_handler === undefined) {
                v.item.on('click', function(event) {
                    stopPropagation(event);
                });
            } else {
                v.item.on('click', {
                    'data': v.click_handler[0],
                    'handler': v.click_handler[1]
                }, function(event) {
                    stopPropagation(event);
                    Menu.closeMenu();

                    if (event.data.handler !== undefined) {
                        event.data.handler(event);
                    }
                });
            }

            menu.append(v.item);
        }

        menu.css('top', y);
        menu.css('left', x);
        menu.outerHeight('auto');
        menu.css('display', 'flex');
        menu.css('z-index', '10001');

        let height = menu.outerHeight();
        let width = menu.outerWidth();

        if (y + height > $(window).outerHeight() - 30) {
            menu.outerHeight($(window).outerHeight() - y - 30);
        }

        if (x + width > $(window).outerWidth() - 20) {
            menu.css('left', Math.max(0, x - width));
        }

        Menu.closeMenu();
        $('body').append(menu);
    }

    static closeMenu() {
        $('#menu').remove();
    }
}

class SettingsWindow extends Window {
    getType() {
        return 'settings';
    }

    getContentCode() {
        return `
<div class="toolbar">
  <select name="settings_backends" class="settings_backends_combobox" autocomplete="off">
    <option value="" selected="selected" disabled="disabled">
      Please select a backend...
    </option>
  </select>
</div>
<div class="window_space settings_space">
<div class="centered">Select a backend first to be able to change its settings.</div>
</div>`;
    }

    getTitle() {
        return 'Settings';
    }

    prepareRefresh() {
        if (this.current_backend !== undefined) {
            this.current_backend.hide();
            this.current_backend.appendTo('body');
        }
    }

    prepareClose() {
        if (this.current_backend !== undefined) {
            this.current_backend.hide();
            this.current_backend.appendTo('body');
        }
    }

    _setup(data, existing_window) {
        this.current_backend = undefined;
        $('.settings_block').each((i, elem) => {
            this.dom.find('.settings_backends_combobox').append(
                new Option($(elem).attr('data-backend'), $(elem).attr('id')));
        });
        this.dom.find('.settings_backends_combobox').on('change', this, event => {
            let parent = event.data;
            parent.dom.find('.settings_backends_combobox option:selected').each((i, elem) => {
                let id = $(elem).val();

                if (parent.current_backend === undefined) {
                    parent.dom.find('.settings_space').html('');
                } else {
                    parent.current_backend.hide();
                    parent.current_backend.appendTo('body');
                }

                parent.current_backend = $('#' + id);
                parent.current_backend.appendTo(parent.dom.find('.settings_space'));
                parent.current_backend.show();
            });
        });
        this.hideLoading();
    }
}

function loadCurrentSession() {
    // $('#off_cpu_sampling_warning').hide();
    // $('#no_off_cpu_warning').hide();
    // $('#glossary').hide();
    // $('#general_analyses').attr('class', 'disabled');
    // $('#general_analyses').attr('onclick', '');
    $('#refresh').attr('class', 'disabled');
    $('#refresh').attr('onclick', '');
    $('#block').html('');
    $('#loading').css('display', 'flex');
    $('#footer_text').text('Please wait...');
    $('#results_combobox option:selected').each(function() {
        let id = $(this).val();
        let label = $(this).attr('data-label');
        let session = id in Session.instances ? Session.instances[id] :
            new Session(id, label);

        $.ajax({
            url: id + '/',
            method: 'GET'
        }).done(function(ajax_obj) {
            let response = JSON.parse(ajax_obj);
            let graph = graphology.Graph.from(response.system);
            let view = new Sigma(graph, $('#block')[0], {

            });
            view.on('doubleClickNode', function(node) {
                node.event.preventSigmaDefault();
                let backend_name = graph.getNodeAttribute(node.node, 'backend');
                import('./modules/' + backend_name + '.js')
                    .then(function(backend) {
                        backend.createRootWindow(node.node, session);
                    });
            });
            $('#loading').hide();
            $('#footer_text').text('You can see a graph describing your computer system. ' +
                                   'Double-click any node to open an internal window ' +
                                   'with its detailed analysis as implemented by its backend.');
            $('#refresh').attr('class', '');
            $('#refresh').attr('onclick', 'loadCurrentSession()');
        }).fail(function(ajax_obj) {
            $('#loading').hide();
            if (ajax_obj.status === 500) {
                $('#footer_text').html('<b><font color="red">Could not load the session because of an ' +
                                       'error on the server side!</font></b>');
            } else {
                $('#footer_text').html('<b><font color="red">Could not load the session! (HTTP code ' +
                                       ajax_obj.status + ')</font></b>');
            }
        });
    });
}

$(document).on('change', '#results_combobox', loadCurrentSession);

function onSessionRefreshClick(event) {
    loadCurrentSession();
}

function onSettingsClick(event) {
    new SettingsWindow('body', undefined, undefined, {});
    // $('#settings_block').css('top', event.clientY);
    // $('#settings_block').css('left', event.clientX);
    // $('#settings_block').css('z-index', '10001');
    // $('#settings_block').show();

    // let width = $('#settings_block').outerWidth();

    // if (event.clientX + width > $(window).outerWidth() - 20) {
    //     $('#settings_block').css(
    //         'left', Math.max(0, event.clientX - width));
    // }

    // event.preventDefault();
    // event.stopPropagation();
}
