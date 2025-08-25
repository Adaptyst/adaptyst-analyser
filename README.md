<!--
SPDX-FileCopyrightText: 2025 CERN

SPDX-License-Identifier: CC-BY-4.0
-->

# Adaptyst Analyser
[![License: GNU GPL v3](https://img.shields.io/badge/license-GNU%20GPL%20v3-blue)]()
[![Version](https://img.shields.io/github/v/release/adaptyst/adaptyst-analyser?include_prereleases&label=version)](https://github.com/Adaptyst/adaptyst-analyser/releases)

A tool for analysing performance analysis results returned e.g. by Adaptyst.

## Disclaimer
This is currently a dev version and the tool is under active development. The tests are limited at the moment and bugs are to be expected. Use at your own risk!

All feedback is welcome.

## License
Copyright (C) CERN.

The project is generally distributed under the GNU GPL v3 (or later version) license, with a few exceptions. See the individual files for their licensing information.

**A new modular version of Adaptyst Analyser is coming soon! It will have a different (still open-source and GPL-based) licensing arrangement than the current one.**

## Installation and documentation
The installation instructions can be found at the Adaptyst website [here](https://adaptyst.web.cern.ch/install#adaptyst-analyser). Similarly, the user documentation can be found [here](https://adaptyst.web.cern.ch/docs/intro/welcome).

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
