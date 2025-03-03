# Adaptyst Analyser
[![License: GNU GPL v3](https://img.shields.io/badge/license-GNU%20GPL%20v3-blue)]()
[![Version: 0.1.dev](https://img.shields.io/badge/version-0.1.dev-red)]()

A tool for analysing performance analysis results returned e.g. by Adaptyst.

## Disclaimer
This is currently a dev version and the tool is under active development. Bugs are to be expected (with the test coverage to be expanded soon). Use at your own risk!

All feedback is welcome.

## License
Copyright (C) CERN.

The project is distributed under the GNU GPL v3 license. See LICENSE for details.

## Installation
### Requirements
Python 3.6 or newer. Also, you must have npm and Node.js 18 or newer during the installation process (you will not need these later). All other dependencies are installed automatically when setting up Adaptyst Analyser.

### Setup
This is a Python package, so you can install it with ```pip```:
```
pip install git+https://github.com/Adaptyst/adaptyst-analyser
```

#### Windows
At the moment, Adaptyst Analyser can be installed only on Unix-like systems such as Linux and macOS. Because these should also include [WSL (Windows Subsystem for Linux)](https://learn.microsoft.com/en-us/windows/wsl/install), you should still be able to use the tool on Windows, with extra steps needed to set up WSL.

## How to use
The web server can be started by running ```adaptyst-analyser <path to results>```, where ```<path to results>``` is the path to a results directory created e.g. by Adaptyst. For configuration options, see ```adaptyst-analyser --help```.

When ```adaptyst-analyser``` is run, look out for an output line similar to this:
```
[2024-10-12 13:57:52 +0200] [2192] [INFO] Listening at: http://127.0.0.1:8000 (2192)
```

The address points to the website where you can browse your profiling results.

Under the hood, Gunicorn and [Flask](https://flask.palletsprojects.com) are used (set up automatically when installing Adaptyst Analyser).

If you prefer not to use ```adaptyst-analyser``` or you cannot use it, set the ```FLASK_PROFILING_STORAGE``` environment variable to the path to a results directory and start the ```adaptystanalyser.app:app``` Flask app using a method of your choice.

### Off-CPU timeline sampling
If you have a profiling session with a huge number of off-CPU regions, rendering the timeline may become resource- and time-consuming for a web browser. In this case, you may want to enable off-CPU timeline sampling which samples captured off-CPU regions in a similar way Adaptyst samples off-CPU activity during profiling. This can be done by running ```adaptyst-analyser -o <sampling period in ms> <path to results>``` or setting the ```FLASK_OFFCPU_SAMPLING``` environment variable to your sampling period in ms in case you don't use ```adaptyst-analyser```.

This mechanism is **disabled** by default, meaning that all captured off-CPU regions are shown. The setting can be changed only on the server side, but moving it to the client side is planned to be done soon.

### Using results from other programs than Adaptyst
While Adaptyst Analyser is designed with Adaptyst in mind, it can be used with any other profiler which produces result files in the Adaptyst format.

You can check the source code of Adaptyst for learning how it formats its profiling results.

## Website layout
After opening the website, follow this getting started guide:
1. Select your profiling session from the "Please select a profiling session" combobox and wait until the timeline loads.
2. In the timeline, you can browse the thread/process tree (including expanding and collapsing threads/processes) on the left and see how long the thread/process ran for on the right in form of timeline blocks.
3. Each thread/process has a corresponding name, PID, and TID.
4. Each block has red and blue parts. Red parts correspond to on-CPU activity while blue parts correspond to off-CPU activity. Not every off-CPU activity may have been captured depending on the off-CPU sampling frequency chosen when profiling.
5. Right-click a thread/process block to check the exact runtime of the thread/process, the ```perf```-sampled runtime, available analysis results (e.g. flame graphs), and the stack trace of a function which spawned the thread/process if available. If the difference between the sampled and exact runtime is significant (the threshold can be adjusted by the user in the settings above the timeline view), the sampled runtime will be shown in red.
6. Click an analysis result of your choice in a thread/process context menu to open it in a new internal window. You can open as many windows as you wish and every window can be freely moved, resized, and collapsed (by clicking the eye icon in a title bar). All windows persist across profiling sessions (so you can e.g. open two windows side-by-side from two different sessions).
7. For flame graphs, you can change the profiling metric, switch between non-time-ordered and time-ordered graphs, search for a specific phrase (regular expressions are also supported), interact with the graphs themselves (e.g. zoom in/out), and download them (as PNG for now). For performance reasons, blocks corresponding to less than a specific percentage of samples will be collapsed ("(compressed)" will be shown instead, you can click it to expand it). This behaviour can be adjusted in the settings above the timeline view.
8. You can open general analysis results (e.g. roofline plots) by clicking the "General analyses" icon next to the settings icon above the timeline view.
9. **NEW:** When checking the spawning stack trace of a thread/process, you can hover over functions to see the corresponding source code files and line numbers if available. If a function is green, you can also click it to open the source code inside the website, with the spawning line highlighted.
10. **NEW:** When checking flame graphs, you can right-click a function block to open the corresponding source code (if available, otherwise nothing will happen) inside the website, with most-metric-contributing lines highlighted in different shades of red along with an option to hover over line numbers to check the sampled metric values.

## Third-party libraries used
Python:
* [Jinja](https://jinja.palletsprojects.com/en/stable)
* [treelib](https://github.com/caesar0301/treelib)
* [Flask](https://flask.palletsprojects.com)
* [Gunicorn](https://gunicorn.org)
* [pytest](https://docs.pytest.org/en/stable)
* [pytest-mock](https://github.com/pytest-dev/pytest-mock)

JavaScript:
* [d3-flame-graph](https://github.com/Adaptyst/d3-flame-graph) (patched and stored in the Adaptyst org)
* [highlight.js](https://highlightjs.org)
* [highlightjs-line-numbers.js](https://github.com/wcoder/highlightjs-line-numbers.js)
* [function-plot](https://mauriciopoppe.github.io/function-plot)
* [vis-timeline](https://github.com/visjs/vis-timeline)

## Acknowledgements
The Adaptyst Analyser development is possible thanks to the following funding sources:
* The European Union HE research and innovation programme, grant agreement No 101092877 (SYCLOPS).
