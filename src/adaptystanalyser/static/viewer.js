// SPDX-FileCopyrightText: 2025 CERN
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Adaptyst Analyser: a tool for analysing performance analysis results

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
        this.modules_loaded = {};
        Session.instances[id] = this;
    }

    /**
     *  Sends a request to the server side of Adaptyst Analyser.
     *  The request will be handled by the Python code of a
     *  corresponding Adaptyst Analyser module.
     *
     *  Use Window.sendRequest() to send requests if you can.
     *  Calling Session.sendRequest() is preferred only in case
     *  you don't have an eligible Window-inheriting object and
     *  don't want to create one.
     *
     *  @param {string} entity ID of an entity.
     *  @param {string} node ID of a node.
     *  @param {string} module Name of a module.
     *  @param {Object} data Data to be sent in form of JSON.
     *  @param done_func Function to be called when the request
     *  succeeds. The function must take exactly one argument
     *  which is the content returned by the server side.
     *  @param fail_func Function to be called when the request
     *  fails for any reason. The function must take exactly the
     *  arguments described in the "error" entry of "settings"
     *  in the jQuery.ajax() documentation
     *  [here](https://api.jquery.com/jQuery.ajax).
     *  @param {string} content_type Content type expected from
     *  the server side. Use one of the values explained in
     *  the "dataType" entry in "settings" in the jQuery.ajax
     *  documentation [here](https://api.jquery.com/jQuery.ajax).
     *  It can be undefined, this is then interpreted as 'json'.
     */
    sendRequest(entity, node, module, data, done_func, fail_func,
                content_type) {
        if (content_type === undefined) {
            content_type = 'json';
        }

        $.ajax({
            url: this.id + '/' + entity + '/' + node + '/' + module,
            method: 'POST',
            dataType: content_type,
            data: data
        }).done((data, status, xhr) => {
            done_func(data);
        }).fail(fail_func);
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

                Window.instances[window_id].triggerResize();
            }
        }
    }

    /**
     *  Gets the path to the server folder where JavaScript
     *  and CSS dependencies of modules are stored. Use the
     *  value returned by this method for constructing
     *  URLs to the dependencies.
     *
     *  @return {string} Path to the folder with JavaScript
     *                   and CSS module dependencies.
     *
     *  @static
     */
    static getDepsPath() {
        return '/static/deps';
    }

    /**
     *  Stops further propagation of an event. It may be useful
     *  e.g. for handling mouse clicks.
     *
     *  @param {Object} event Event which propagation should be stopped.
     *
     *  @static
     */
    static stopPropagation(event) {
        event.stopPropagation();
        event.preventDefault();
    }

    #id;
    #session;
    #entity_id;
    #node_id;
    #data;
    #module_name;
    #being_resized;
    #collapsed;
    #last_focus;
    #dom;
    #first_resize_call;
    #loading_jquery;
    #setup_data;
    #min_height;
    #last_height;
    #content;
    #custom_title;

    /**
     *  Constructs a Window object and displays a window
     *  corresponding to the object. All subclasses
     *  must call this constructor.
     *
     *  @constructor
     *  @param {Object} [session] `Session` object corresponding
     *  to a window. This is provided by a parameter of
     *  `createRootWindow()`. It can be undefined.
     *  @param {string} [entity_id] The ID of an entity corresponding
     *  to a window. This is provided by a parameter of
     *  `createRootWindow()`. It can be undefined.
     *  @param {string} [node_id] The ID of a node corresponding
     *  to a window. This is provided by a parameter of
     *  `createRootWindow()`. It can be undefined.
     *  @param {string} [module_name] The name of a module within
     *  a node corresponding to a window. It can be undefined.
     *  @param [data] Arbitrary data to be passed to `_setup()`.
     *  It can be undefined.
     *  @param {int} [x] x-part of the initial upper-left corner
     *  position of a window. If undefined, the value of `y` will
     *  be ignored and the window will be centered.
     *  @param {int} [y] y-part of the initial upper-left corner
     *  position of a window. If undefined, the value of `x` will
     *  be ignored and the window will be centered.
     */
    constructor(session, entity_id, node_id,
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

        this.#id = id;
        this.#session = session;
        this.#entity_id = entity_id;
        this.#node_id = node_id;
        this.#data = {};
        this.#module_name = module_name;
        this.#being_resized = false;
        this.#collapsed = false;
        this.#last_focus = Date.now();
        this.#dom = this.#createWindowDOM();
        this.#custom_title = undefined;

        if (x !== undefined && y !== undefined) {
            this.#dom.css('left', x + 'px');
            this.#dom.css('top', y + 'px');
        } else {
            this.#dom.css('top', '50%');
            this.#dom.css('left', '50%');
            this.#dom.css('transform', 'translate(-50%, -50%)');
        }

        this.#first_resize_call = true;
        new ResizeObserver(Window.onResize).observe(this.#dom[0]);

        if (data === undefined) {
            this.#setup({});
        } else {
            this.#setup(data);
        }
    }

    /**
     *  Sends a request to the server side of Adaptyst Analyser.
     *  The request will be handled by the Python code of a
     *  corresponding Adaptyst Analyser module.
     *
     *  Use this function only if you have constructed your
     *  object with all of an entity ID, a node ID, and a module
     *  name.
     *
     *  @param {Object} data Data to be sent in form of JSON.
     *  @param done_func Function to be called when the request
     *  succeeds. The function must take exactly one argument
     *  which is a JSON object returned by the server side.
     *  @param fail_func Function to be called when the request
     *  fails for any reason. The function must take exactly the
     *  arguments described in the "error" entry of "settings"
     *  in the jQuery.ajax() documentation
     *  [here](https://api.jquery.com/jQuery.ajax).
     *  @param {string} content_type Content type expected from
     *  the server side. Use one of the values explained in
     *  the "dataType" entry in "settings" in the jQuery.ajax
     *  documentation [here](https://api.jquery.com/jQuery.ajax).
     *  It can be undefined, this is then interpreted as 'json'.
     */
    sendRequest(data, done_func, fail_func, content_type) {
        this.getSession().sendRequest(this.getEntityId(),
                                      this.getNodeId(),
                                      this.getModuleName(),
                                      data, done_func, fail_func,
                                      content_type);
    }

    /**
     *  Gets the last time a window was focused.
     *
     *  @return Last time a window was focused,
     *  as a number representing a Unix timestamp in
     *  milliseconds.
     */
    getLastFocusTime() {
        return this.#last_focus;
    }

    /**
     *  Gets the ID of a window.
     *
     *  @return {string} ID of a window.
     */
    getId() {
        return this.#id;
    }

    /**
     *  Gets the entity ID of a window. It can be
     *  undefined.
     *
     *  @return {string} Entity ID of a window.
     */
    getEntityId() {
        return this.#entity_id;
    }

    /**
     *  Gets the node ID of a window. It can be
     *  undefined.
     *
     *  @return {string} Node ID of a window.
     */
    getNodeId() {
        return this.#node_id;
    }

    /**
     *  Gets the module name of a window. It can be
     *  undefined.
     *
     *  @return {string} Module name of a window.
     */
    getModuleName() {
        return this.#module_name;
    }

    /**
     *  Gets the dictionary of a window. It can be
     *  filled with arbitrary data.
     *
     *  @return {Object} Dictionary of a window.
     */
    getData() {
        return this.#data;
    }

    /**
     *  Gets the performance session a window is part of.
     *
     *  @return {Object} Session of a window.
     */
    getSession() {
        return this.#session;
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

    // Private, not meant to be called by any external code.
    #getProcessedContentObject() {
        let content = $(this.getContentCode());

        // SVGs below are from Google Material Icons, originally licensed under
        // Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
        // (covered by GNU GPL v3 here)

        // ************************
        let setUpIcon = (target, code) => {
            let obj = content.find('[data-icon="' + target + '"]');
            let path = $(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
            path.attr('d', code);
            obj.append(path);
            obj.attr('xmlns', '');
            obj.attr('viewBox', '0 -960 960 960');
        };

        setUpIcon('general', 'M282.67-278h66.66v-203.33h-66.66V-278Zm328 0h66.66v-413.33h-66.66V-278Zm-164 0h66.66v-118.67h-66.66V-278Zm0-203.33h66.66V-548h-66.66v66.67ZM186.67-120q-27 0-46.84-19.83Q120-159.67 120-186.67v-586.66q0-27 19.83-46.84Q159.67-840 186.67-840h586.66q27 0 46.84 19.83Q840-800.33 840-773.33v586.66q0 27-19.83 46.84Q800.33-120 773.33-120H186.67Zm0-66.67h586.66v-586.66H186.67v586.66Zm0-586.66v586.66-586.66Z');
        setUpIcon('warning', 'm40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z');
        setUpIcon('replace', 'M164-560q14-103 91.5-171.5T440-800q59 0 110.5 22.5T640-716v-84h80v240H480v-80h120q-29-36-69.5-58T440-720q-72 0-127 45.5T244-560h-80Zm620 440L608-296q-36 27-78.5 41.5T440-240q-59 0-110.5-22.5T240-324v84h-80v-240h240v80H280q29 36 69.5 58t90.5 22q72 0 127-45.5T636-480h80q-5 36-18 67.5T664-352l176 176-56 56Z');
        setUpIcon('download', 'M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z');
        setUpIcon('delete', 'M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z');
        setUpIcon('copy', 'M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z');
        // ************************
        return content;
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
        if (this.#content === undefined) {
            this.#content = this.#dom.find('.window_content');
        }

        return this.#content;
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
       viewBox="0 -960 960 960" width="24px" onmousedown="Window.stopPropagation(event)">
    <title>Reset window contents</title>
    <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100
             70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
  </svg>
  <!-- This SVG is from Google Material Icons, originally licensed under
       Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
       (covered by GNU GPL v3 here) -->
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960"
       width="24px" class="window_edit_title" onmousedown="Window.stopPropagation(event)">
    <title>Edit title</title>
    <path d="M160-400v-80h280v80H160Zm0-160v-80h440v80H160Zm0-160v-80h440v80H160Zm360 560v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q8 9 12.5 20t4.5 22q0 11-4 22.5T863-380L643-160H520Zm300-263-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z"/>
  </svg>
  <!-- This SVG is from Google Material Icons, originally licensed under
       Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
       (covered by GNU GPL v3 here) -->
  <svg xmlns="http://www.w3.org/2000/svg" class="window_visibility" height="24px"
       viewBox="0 -960 960 960" width="24px" onmousedown="Window.stopPropagation(event)">
    <title>Toggle visibility</title>
    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45
             31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54
             137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/>
  </svg>
  <!-- This SVG is from Google Material Icons, originally licensed under
       Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0.txt
       (covered by GNU GPL v3 here) -->
  <svg xmlns="http://www.w3.org/2000/svg" class="window_close" height="24px"
       viewBox="0 -960 960 960" width="24px" onmousedown="Window.stopPropagation(event)">
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
        content.html(this.#getProcessedContentObject());

        root.append(content);

        root.attr('id', this.#id);
        root.attr('onclick', `Window.instances['${this.#id}'].focus()`);
        root.attr('onmouseup', `Window.instances['${this.#id}'].onMouseUp()`);
        root.find('.window_header').attr('onmousedown', `Window.instances['${this.#id}'].startDrag(event)`);
        root.find('.window_refresh').attr(
            'onclick', `Window.instances['${this.#id}'].onRefreshClick(event)`);
        root.find('.window_visibility').attr(
            'onclick', `Window.instances['${this.#id}'].onVisibilityClick(event)`);
        root.find('.window_edit_title').attr(
            'onclick', `Window.instances['${this.#id}'].onEditTitleClick(event)`);
        root.find('.window_close').attr(
            'onclick', `Window.instances['${this.#id}'].close(event)`);

        return root;
    }

    // Private, not meant to be called by any external code.
    onEditTitleClick(event) {
        let title = window.prompt('Enter a new title for the window. ' +
                                  'The session prefix will remain ' +
                                  'unchanged if present.',
                                  this.#custom_title === undefined ?
                                  this.getTitle() : this.#custom_title);

        if (title == undefined || title === '') {
            return;
        }

        if (this.#session === undefined) {
            this.#dom.find('.window_title').text(title);
        } else {
            this.#dom.find('.window_title').text(
                '[Session: ' + this.#session.label + '] ' +
                    title);
        }

        this.#custom_title = title;
    }

    /**
     *  Downloads a given SVG object in a window as an SVG file.
     *
     *  @param {string} [class_name] The class name of an SVG object.
     *  It is expected that the object has a unique class name within
     *  the window. Otherwise, the behaviour is undefined.
     *  @param {string} [css] The path to a CSS stylesheet to be
     *  applied to the SVG before downloading.
     */
    downloadSvg(class_name, css) {
        $.ajax({
            url: css,
            method: 'GET',
            dataType: 'text'
        }).done(res => {
            let svg = this.getContent().find('.' + class_name).children()[0].cloneNode(true);

            let style = document.createElement('style');
            style.innerHTML = res;
            svg.insertBefore(style, svg.firstChild);

            let data = document.createElement('a');
            data.download = 'flamegraph.svg';
            data.href = 'data:image/svg+xml;charset=utf-8,' +
                encodeURIComponent((new XMLSerializer()).serializeToString(svg));
            data.addEventListener('click', event => {
                event.stopPropagation();
            });
            data.click();
        }).fail(res => {
            window.alert('Could not download a stylesheet for the SVG!');
        });
    }

    /**
     *  Focuses a window.
     */
    focus() {
        let window_header = this.#dom.find('.window_header');

        if (Window.#current_focused_id !== this.#id) {
            if (Window.#largest_z_index >= 10000) {
                let z_index_arr = [];

                for (const w of Object.values(Window.instances)) {
                    z_index_arr.push({'index': w.getZIndex(),
                                      'id': w.getId()});
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

                this.#dom.css('z-index', index);
                Window.#largest_z_index = index;
            } else {
                Window.#largest_z_index += 1;
                this.#dom.css('z-index', Window.#largest_z_index);
            }

            window_header.css('background-color', 'black');
            window_header.css('color', 'white');
            window_header.css('fill', 'white');

            for (const w of Object.values(Window.instances)) {
                if (w.getId() !== this.getId()) {
                    w.unfocus();
                }
            }

            Window.#current_focused_id = this.getId();
            this.#last_focus = Date.now();
        }
    }

    /**
     *  Unfocuses a window.
     */
    unfocus() {
        let unfocused_header = this.#dom.find('.window_header');
        unfocused_header.css('background-color', 'lightgray');
        unfocused_header.css('color', 'black');
        unfocused_header.css('fill', 'black');
    }

    // Private, not meant to be called by any external code.
    onMouseUp() {
        if (this.#being_resized) {
            this.finishResize();
            this.#being_resized = false;
        }
    }

    /**
     *  Triggers window resizing event-wise.
     */
    triggerResize() {
        this.#being_resized = this.startResize();
    }

    /**
     *  Called when a user starts resizing a window.
     *
     *  @abstract
     *  @return {bool} Whether finishResize() should be
     *  called after resizing is complete.
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
        Window.stopPropagation(event);
        this.focus();

        let dragged = document.getElementById(this.#id);
        let startX = event.offsetX;
        let startY = event.offsetY;

        $('body').mousemove(event => {
            event.stopPropagation();
            event.preventDefault();
            let newX = event.pageX - startX;
            let newY = event.pageY - startY;
            let dragged_rect = dragged.getBoundingClientRect();

            dragged.style.transform = '';
            dragged.style.left = newX + 'px';
            dragged.style.top = newY + 'px';
        });

        $('body').mouseup(event => {
            $('body').off('mousemove');
            $('body').off('mouseup');
        });
    }

    // Private, not meant to be called by any external code.
    onRefreshClick(event) {
        Window.stopPropagation(event);

        this.prepareRefresh(this.#setup_data);

        this.#dom.find('.window_content').html(this.#getProcessedContentObject());
        this.#setup();
    }

    /**
     *  Gets the value of the z-index CSS property of a window.
     *
     *  @return Value of z-index of a window.
     */
    getZIndex() {
        return this.#dom.css('z-index');
    }

    /**
     *  Called when a user refreshes a window, before the proper
     *  refresh process with the content resetup takes place.
     *
     *  The old window content is still available when this
     *  method is called.
     *
     *  @abstract
     *  @param data Arbitrary data that have been passed to the
     *  constructor and will be available in _setup(), e.g. a dictionary.
     */
    prepareRefresh(data) {
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
        this.#loading_jquery = $('#loading').clone();
        this.#loading_jquery.removeAttr('id');
        this.#loading_jquery.attr('class', 'loading');
        this.#loading_jquery.prependTo(this.#dom.find('.window_content'));
        this.#loading_jquery.show();
    }

    /**
     *  Hides the loading indicator in a window.
     */
    hideLoading() {
        this.#loading_jquery.hide();
    }

    // Private, not meant to be called by any external code.
    #setup(data) {
        let existing_window = false;

        if (data === undefined) {
            data = this.#setup_data;
            existing_window = true;
        }

        if (this.#custom_title === undefined) {
            if (this.#session === undefined) {
                this.#dom.find('.window_title').text(this.getTitle());
            } else {
                this.#dom.find('.window_title').text(
                    '[Session: ' + this.#session.label + '] ' +
                        this.getTitle());
            }
        }

        this.showLoading();

        if (!existing_window) {
            this.#dom.appendTo('body');
            this.focus();
        }

        this.#setup_data = data;
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
     *  Otherwise, there will be a loading indicator in the window instead
     *  of a desired content.
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
        Window.stopPropagation(event);

        this.prepareClose();

        this.#dom.remove();
        delete Window.instances[this.#id];

        let keys = Object.keys(Window.instances);

        if (keys.length === 0) {
            return;
        }

        keys.sort((a, b) => {
            return Window.instances[b].getLastFocusTime() - Window.instances[a].getLastFocusTime();
        });

        Window.instances[keys[0]].focus();
    }

    // Private, not meant to be called by any external code.
    onVisibilityClick(event) {
        Window.stopPropagation(event);

        let window_content = this.#dom.find('.window_content');
        let window_header = this.#dom.find('.window_header');

        if (!this.#collapsed) {
            let position = this.#dom.position();

            this.#dom.css('transform', '');
            this.#dom.css('left', position.left);
            this.#dom.css('top', position.top);

            this.#collapsed = true;
            this.#min_height = this.#dom.css('min-height');
            this.#last_height = this.#dom.outerHeight();
            this.#dom.css('min-height', '0');
            this.#dom.css('resize', 'horizontal');
            this.#dom.height(window_header.outerHeight());
        } else {
            this.#collapsed = false;
            this.#dom.height(this.#last_height);
            this.#dom.css('min-height', this.#min_height);
            this.#dom.css('resize', 'both');
            this.#dom.css('opacity', '');
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
                Window.stopPropagation(event);
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
                v.item.on('click', event => {
                    Window.stopPropagation(event);
                });
            } else {
                v.item.on('click', {
                    'data': v.click_handler[0],
                    'handler': v.click_handler[1]
                }, event => {
                    Window.stopPropagation(event);
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
    #current_backend;

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

    startResize() {

    }

    finishResize() {

    }

    getTitle() {
        return 'Settings';
    }

    prepareRefresh() {
        if (this.#current_backend !== undefined) {
            this.#current_backend.hide();
            this.#current_backend.appendTo('body');
        }
    }

    prepareClose() {
        if (this.#current_backend !== undefined) {
            this.#current_backend.hide();
            this.#current_backend.appendTo('body');
        }
    }

    _setup(data, existing_window) {
        $('.settings_block').each((i, elem) => {
            this.getContent().find('.settings_backends_combobox').append(
                new Option($(elem).attr('data-backend'), $(elem).attr('id')));
        });
        this.getContent().find('.settings_backends_combobox').on('change', event => {
            this.getContent().find('.settings_backends_combobox option:selected').each((i, elem) => {
                let id = $(elem).val();

                if (this.#current_backend === undefined) {
                    this.getContent().find('.settings_space').html('');
                } else {
                    this.#current_backend.hide();
                    this.#current_backend.appendTo('body');
                }

                this.#current_backend = $('#' + id);
                this.#current_backend.appendTo(this.getContent().find('.settings_space'));
                this.#current_backend.show();
            });
        });
        this.hideLoading();
    }
}

// Private, not meant to be called by any external code.
function loadCurrentSession() {
    let versionLessThan = (a, b) => {
        for (var i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] > b[i]) {
                return false;
            }

            if (a[i] < b[i]) {
                return true;
            }
        }

        if (a.length >= b.length) {
            return false;
        } else {
            return true;
        }
    };

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
        let min_mod_vers = JSON.parse($('#viewer_script').attr('data-min-mod-vers'));

        $.ajax({
            url: id + '/',
            method: 'GET'
        }).done(ajax_obj => {
            let response = JSON.parse(ajax_obj);
            let graph = graphology.Graph.from(response.system);
            let view = new Sigma(graph, $('#block')[0], {

            });
            view.on('doubleClickNode', (node) => {
                node.event.preventSigmaDefault();
                let backends = graph.getNodeAttribute(node.node, 'backends');
                let entity = graph.getNodeAttribute(node.node, 'entity');
                let options = [];

                for (let [name, version] of backends) {
                    let item_label = name;

                    if (version.length === 0) {
                        item_label += ' (unknown version)';
                    }

                    options.push([item_label,
                                  [{
                                      backend_name: name,
                                      entity: entity,
                                      node: node.node,
                                      session: session
                                  }, (event) => {
                                      if (version.length > 0 && (name in min_mod_vers) &&
                                          min_mod_vers[name].length > 0 &&
                                          versionLessThan(version, min_mod_vers[name])) {
                                          let proceed =
                                              window.confirm('The Adaptyst module used for producing the results is ' +
                                                             'older than the minimum version supported by the ' +
                                                             'corresponding Adaptyst Analyser module!\n\n' +
                                                             'Expect errors and incorrect behaviours. Click ' +
                                                             'OK if you want to proceed.');

                                          if (!proceed) {
                                              return;
                                          }
                                      }

                                      import('./modules/' + event.data.data.backend_name + '/backend.js')
                                          .then(backend => {
                                              if (!(event.data.data.backend_name in
                                                    event.data.data.session.modules_loaded)) {
                                                  $('<link type="text/css" rel="stylesheet" href="/static/' +
                                                    'modules/' + event.data.data.backend_name + '/backend.css" />').appendTo('head');
                                                  event.data.data.session.modules_loaded[event.data.data.backend_name] = true;
                                              }

                                              backend.createRootWindow(event.data.data.entity,
                                                                       event.data.data.node,
                                                                       event.data.data.session);
                                          }, () => {
                                              window.alert('Could not load the module! ' +
                                                           'Are you sure it is installed?');
                                          });
                                  }]]);
                }

                Menu.createMenu(node.event.original.pageX,
                                node.event.original.pageY,
                                options);
            });
            $('#loading').hide();

            let non_zero_exit_codes = [];

            for (const [entity, data] of Object.entries(response.entities)) {
                if (data[0] > 0) {
                    non_zero_exit_codes.push([entity, data[0]]);
                }
            }

            if (non_zero_exit_codes.length === 0) {
                $('#footer_text').text('You can see a graph describing your computer system. ' +
                                       'Double-click any node and select a module to open an internal window ' +
                                       'with a detailed analysis of the node done by the module.');
            } else {
                let entity_cnt_hover = '';

                for (let i = 0; i < non_zero_exit_codes.length; i++) {
                    entity_cnt_hover += non_zero_exit_codes[i][0] + ': exit code ' +
                        non_zero_exit_codes[i][1] +
                        (non_zero_exit_codes[i][1] === 255 ? ' (may suggest a fatal error, ' +
                         'e.g. a seg fault)' : '') +
                        (i < non_zero_exit_codes.length - 1 ? '\n' : '');
                }

                $('#footer_text').html('You can see a graph describing your computer system. ' +
                                       'Double-click any node and select a module to open an internal window ' +
                                       'with a detailed analysis of the node done by the module.<br />' +
                                       '<b><font color="#ff9900">WARNING:</font></b> The workflow in ' +
                                       '<span style="cursor:help; text-decoration:underline" ' +
                                       'title="' + entity_cnt_hover + '">' +
                                       (non_zero_exit_codes.length === 1 ? '1 entity' :
                                        (non_zero_exit_codes.length) + ' entities') + '</span> ' +
                                       'returned a non-zero exit code. Hover over the underlined text to ' +
                                       'see more details.');
            }

            $('#refresh').attr('class', '');
            $('#refresh').attr('onclick', 'loadCurrentSession()');
        }).fail(ajax_obj => {
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
