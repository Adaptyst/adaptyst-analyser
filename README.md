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
