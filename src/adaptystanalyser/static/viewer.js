// SPDX-FileCopyrightText: 2025 CERN
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Adaptyst Analyser: a tool for analysing performance analysis results

/**
 *  Stops further propagation of an event. It may be useful
 *  e.g. for handling mouse clicks.
 *
 *  @param {Object} event Event which propagation should be stopped.
 */
function stopPropagation(event) {
    event.stopPropagation();
    event.preventDefault();
}

/**
 *  This class represents a performance analysis session.
 */
class Session {
    /**
     *  Static dictionary storing all instances of a Session
     *  class under their IDs.
     *
     *  @static
     */
    static instances = {};

    /**
     *  Constructs a Session object, which is the main
     *  place for storing all information about a performance
     *  analysis session.
     *
     *  @constructor
     *  @param {string} id ID of a session as known by the server.
     *  @param {string} label Human-readable label of a session.
     */
    constructor(id, label) {
        this.id = id;
        this.label = label;
        this.module_data = {};
        Session.instances[id] = this;
    }
}

/**
 *  This abstract class represents an internal window.
 *
 *  If you want to display a window in Adaptyst Analyser,
 *  you must implement a new class inheriting from this class
 *  and implementing its abstract methods.
 */
class Window {
    /**
     *  Static dictionary storing all instances of a Window
     *  class (or one of its subclasses) under their IDs as returned
     *  by `getId()`.
     *
     *  @static
     */
    static instances = {};

    // Private, not meant to be used by any external code.
    static #current_focused_id = undefined;

    // Private, not meant to be used by any external code.
    static #largest_z_index = 0;

    // Private, not meant to be called by any external code.
    static #changeFocus(window_id) {
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

        if (Window.#current_focused_id !== window_id) {
            if (Window.#largest_z_index >= 10000) {
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
                Window.#largest_z_index = index;
            } else {
                Window.#largest_z_index += 1;
                window.dom.css('z-index', Window.#largest_z_index);
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

            Window.#current_focused_id = window_id;
            Window.instances[window_id].last_focus = Date.now();
        }
    }

    // Private, not meant to be called by any external code.
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

    /**
     *  Constructs a Window object and displays a window
     *  corresponding to the object. All subclasses
     *  must call this constructor.
     *
     *  @constructor
     *  @param {Object} [session] `Session` object corresponding
     *  to a window. This is provided by a parameter of
     *  `createRootWindow()`. If undefined, `getModuleData()` will
     *  always return `undefined`.
     *  @param {string} [node_id] The ID of a node corresponding
     *  to a window. This is provided by a parameter of
     *  `createRootWindow()`. If undefined, `getModuleData()` will
     *  always return `undefined`.
     *  @param {string} [module_name] The name of a module within
     *  a node corresponding to a window. If undefined, `getModuleData()`
     *  will always return `undefined`.
     *  @param [data] Arbitrary data to be passed to `_setup()`.
     *  @param {int} [x] x-part of the initial upper-left corner
     *  position of a window. If undefined, the value of `y` will
     *  be ignored and the window will be centered.
     *  @param {int} [y] y-part of the initial upper-left corner
     *  position of a window. If undefined, the value of `x` will
     *  be ignored and the window will be centered.
     */
    constructor(session, node_id,
                module_name, data, x, y) {
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
        this.module_name = module_name;
        this.data = {};
        this.being_resized = false;
        this.collapsed = false;
        this.last_focus = Date.now();
        this.dom = this.#createWindowDOM();

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

        this.#setup(data);
    }

    /**
     *  Gets the ID of a window.
     *
     *  @return {string} ID of a window.
     */
    getId() {
        return this.id;
    }

    /**
     *  Gets the type of a window. This is used in the ID
     *  of a window, an HTML class of the window
     *  (i.e. `<type>_window`), and an HTML class of
     *  the window content (i.e. `<type>_content`).
     *
     *  @abstract
     *  @return {string} Type of a window.
     */
    getType() {
        throw new Error('This is an abstract method!');
    }

    /**
     *  Gets the content of a window in form of an HTML code.
     *
     *  Window header and border rendering along with basic window
     *  operations except resizing is fully handled by Adaptyst
     *  Analyser and you shouldn't implement it yourself. Resizing
     *  is partially handled by Adaptyst Analyser and should also 
     *  not be implemented here, see `startResize()` and
     *  `finishResize()` instead.
     *
     *  A padding of 5 pixels is applied to the content of
     *  all windows in Adaptyst Analyser.
     *
     *  @abstract
     *  @return {string} HTML code of the content of a window.
     */
    getContentCode() {
        throw new Error('This is an abstract method!');
    }

    /**
     *  Gets the content of a window in form of a jQuery object.
     *  The return value of this function is based on your implementation
     *  of `getContentCode()`.
     *
     *  @return {Object} jQuery object representing the content of a window.
     */
    getContent() {
        return this.dom.find('.window_content');
    }

    // Private, not meant to be called by any external code.
    #createWindowDOM() {
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

    /**
     *  Focuses a window.
     */
    focus() {
        Window.#changeFocus(this.id);
    }

    // Private, not meant to be called by any external code.
    onMouseUp() {
        if (this.being_resized) {
            this.finishResize();
            this.being_resized = false;
        }
    }

    /**
     *  Called when a user starts resizing a window.
     *
     *  @abstract
     */
    startResize() {
        throw new Error('This is an abstract method!');
    }

    /**
     *  Called when a user finishes resizing a window.
     *
     *  @abstract
     */
    finishResize() {
        throw new Error('This is an abstract method!');
    }

    // Private, not meant to be called by any external code.
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

    // Private, not meant to be called by any external code.
    onRefreshClick(event) {
        stopPropagation(event);

        this.prepareRefresh();

        this.dom.find('.window_content').html(this.getContentCode());
        this.data = {}
        this.setup();
    }

    /**
     *  Called when a user refreshes a window, before the proper
     *  refresh process with the content resetup takes place.
     *
     *  @abstract
     */
    prepareRefresh() {
        throw new Error('This is an abstract method!');
    }

    /**
     *  Called when a user closes a window, before it is actually
     *  closed.

     *  @abstract
     */
    prepareClose() {
        throw new Error('This is an abstract method!');
    }

    /**
     *  Shows the loading indicator in a window.
     */
    showLoading() {
        this.loading_jquery = $('#loading').clone();
        this.loading_jquery.removeAttr('id');
        this.loading_jquery.attr('class', 'loading');
        this.loading_jquery.prependTo(this.dom.find('.window_content'));
        this.loading_jquery.show();
    }

    /**
     *  Hides the loading indicator in a window.
     */
    hideLoading() {
        this.loading_jquery.hide();
    }

    // Private, not meant to be called by any external code.
    #setup(data) {
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
            this.dom.appendTo('body');
            this.focus();
        }

        this.setup_data = data;
        this._setup(data, existing_window);
    }

    /**
     *  Gets the title of a window.

     *  @abstract
     *  @return {string} Title of a window.
     */
    getTitle() {
        throw new Error('This is an abstract method!');
    }

    /**
     *  Sets up a window. This is always called when the window is opened or
     *  refreshed. Use `getContent()` to get a jQuery object for manipulating
     *  the window content.
     *
     *  **Important:** This function must call `hideLoading()` at some point.
     *  Otherwise, there will be a clearly-visible loading indicator in
     *  the window.
     *
     *  @abstract
     *  @param data Arbitrary data passed to the constructor, e.g.
     *  a dictionary.
     *  @param {bool} existing_window Whether a window is already displayed.
     */
    _setup(data, existing_window) {
        throw new Error('This is an abstract method!');
    }

    // Private, not meant to be called by any external code.
    close(event) {
        stopPropagation(event);

        this.prepareClose();

        this.dom.remove();
        delete Window.instances[this.id];
        Window.#changeFocus();
    }

    /**
     *  Gets a modifiable dictionary storing arbitrary
     *  data related to a corresponding module of a node.
     *
     *  The object must have been constructed with defined
     *  values of `session`, `node_id`, and `module_name`.
     *  Otherwise, this function returns `undefined`.
     *
     *  @return {Object} Modifiable dictionary or
     *  `undefined` if the object is not constructed with
     *  `session`, `node_id`, and `module_name`.
     */
    getModuleData() {
        if (this.session == undefined ||
            this.node_id == undefined ||
            this.module_name == undefined) {
            return undefined;
        }

        if (this.session.module_data[this.node_id] == undefined) {
            this.session.module_data[this.node_id] = {};
        }

        if (this.session.module_data[this.node_id][this.module_name] == undefined) {
            this.session.module_data[this.node_id][this.module_name] = {};
        }

        return this.session.module_data[this.node_id][this.module_name];
    }

    // Private, not meant to be called by any external code.
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

/**
 *  This class contains static methods for managing menus.
 *  It is not meant to be constructed.
 *
 *  **Only one menu can be open at a time.**
 */
class Menu {
    /**
     *  Creates and displays a menu.
     *
     *  @static
     *  @param {int} x x-part of the upper-left corner position
     *  of a menu.
     *  @param {int} y y-part of the upper-left corner position
     *  of a menu.
     *  @param {Array} options Array of menu items of type
     *  `[k, v]`, where `k` is the label of a menu item to be
     *  displayed and `v` is of form `[<arbitrary data>,
     *  <click event handler>]`. Click event handlers must
     *  accept `event` (corresponding to a JavaScript
     *  click event object) as the first argument. `<arbitrary
     *  data>` will be accessible in a click handler through
     *  `event.data.data`.
     */
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

    /**
     *  Creates and displays a menu with custom-made blocks.
     *
     *  @static
     *  @param {int} x x-part of the upper-left corner position
     *  of a menu.
     *  @param {int} y y-part of the upper-left corner position
     *  of a menu.
     *  @param {Array} blocks Array of custom menu items of type
     *  `{item: <item>, hover: <hover>, click_handler: [<arbitrary
     *  data>, <click event handler>]}`, where `<item>` is
     *  a jQuery object representing a custom menu item element
     *  (e.g. `$('<div>Hello World!</div>')`), `<hover>` is a
     *  boolean indicating whether the item should be highlighted
     *  on hover, and `[<arbitrary data>, <click event handler>]`
     *  is the same as in `createMenu()`. `<hover>` is optional,
     *  its default value is false.
     */
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

    /**
     *  Closes a menu.
     */
    static closeMenu() {
        $('#menu').remove();
    }
}

// Private, not meant to be used by any external code.
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

// Private, not meant to be called by any external code.
function loadCurrentSession() {
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
                import('./modules/' + backend_name + '/backend.js')
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

// Private, not meant to be called by any external code.
function onSessionRefreshClick(event) {
    loadCurrentSession();
}

// Private, not meant to be called by any external code.
function onSettingsClick(event) {
    new SettingsWindow(undefined, undefined, undefined, {});
}
