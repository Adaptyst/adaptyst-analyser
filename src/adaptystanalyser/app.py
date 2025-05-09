# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import traceback
from flask import Flask, render_template, request
from pathlib import Path
from . import ProfilingResults, Identifier


app = Flask(__name__)
app.config.from_prefixed_env()


if 'PROFILING_STORAGE' not in app.config:
    raise RuntimeError('Please set FLASK_PROFILING_STORAGE environment '
                       'variable to the absolute path to a directory where '
                       'Adaptyst profiling results are stored '
                       '(usually "results").')


static_path = Path(app.root_path) / 'static'
scripts = list(sorted(map(lambda x: x.name,
                          static_path.glob('*.js'))))
stylesheets = list(sorted(map(lambda x: x.name,
                              static_path.glob('*.css'))))
d3_flamegraph_css = (static_path / 'd3-flamegraph.css').read_text()


@app.post('/<identifier>/')
def post(identifier):
    """
    Process a POST request relevant to a profiling session with
    an identifier given in the URL. The request should have one of the
    following arguments:
    * "tree" (with any value):
      This instructs Adaptyst Analyser to return the thread/process
      tree obtained in the session.
    * "perf_map" (with any value):
      This instructs Adaptyst Analyser to return perf symbol maps
      obtained in the session.
    * "general_analysis" (with a string value):
      This instructs Adaptyst Analyser to return general analysis data
      of a type specified in the value (e.g. "roofline" for a cache-aware
      roofline model).
    * "pid" (with a numeric value) and "tid" (with a numeric value)
      and "threshold" (with a decimal value):
      This instructs Adaptyst Analyser to return a flame graph of
      the thread/process with a given PID and TID to be rendered by
      d3-flame-graph, taking into account to collapse blocks taking
      less than a specified share of samples (e.g. if "threshold" is
      set to 0.10, blocks taking less than 10% of samples
      will be collapsed, with an option to expand them at runtime).
    * "callchain" (with any value):
      This instructs Adaptyst Analyser to return the session dictionaries
      mapping compressed symbol names to full symbol names.
    * "src" (with a string value):
      This instructs Adaptyst Analyser to return the source code stored
      in the session under a provided name.

    :param str identifier: A profiling session identifier in the form
                           described in the Identifier class docstring.
    """
    try:
        # Check if identifier is correct by verifying that ValueError
        # is not raised
        Identifier(identifier)

        if 'tree' in request.values or 'perf_map' in request.values or \
           'general_analysis' in request.values or \
           ('pid' in request.values and 'tid' in request.values and
            'threshold' in request.values) or \
           'callchain' in request.values or 'src' in request.values:
            results = ProfilingResults(app.config['PROFILING_STORAGE'],
                                       identifier)

            if 'tree' in request.values:
                return results.get_json_tree()
            elif 'perf_map' in request.values:
                return results.get_perf_maps()
            elif 'general_analysis' in request.values:
                json_data = results.get_general_analysis(
                    request.values['general_analysis'])

                if json_data is None:
                    return '', 404
                else:
                    return json_data
            elif 'pid' in request.values and 'tid' in request.values and \
                 'threshold' in request.values:
                json_data = results.get_flame_graph(
                    request.values['pid'],
                    request.values['tid'],
                    float(request.values['threshold']))

                if json_data is None:
                    return '', 404
                else:
                    return json_data
            elif 'callchain' in request.values:
                return results.get_callchain_mappings()
            elif 'src' in request.values:
                result = results.get_source_code(request.values['src'])

                if result is None:
                    return '', 404

                return result
        else:
            return '', 400
    except ValueError:
        traceback.print_exc()
        return '', 404


@app.route('/')
def main():
    # offcpu_sampling describes the sampling *period* (not
    # frequency) in ms for off-CPU regions to be displayed on the
    # timeline (as rendering a large number of these regions
    # can be resource-heavy). It works in a similar way to
    # sampling in off-CPU profiling in Adaptyst.
    return render_template(
        'viewer.html',
        ids=ProfilingResults.get_all_ids(
            app.config['PROFILING_STORAGE']),
        offcpu_sampling=app.config.get(
            'OFFCPU_SAMPLING', 1),
        scripts=scripts,
        stylesheets=stylesheets,
        d3_flamegraph_css=d3_flamegraph_css.replace('\n', ' '))
