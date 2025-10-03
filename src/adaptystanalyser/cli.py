# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import argparse
import sys
import subprocess
import os
import yaml
import shutil
import filecmp
import urllib.request
from urllib.parse import urlparse
from pathlib import Path
from importlib import import_module
from importlib.metadata import version


def main():
    parser = argparse.ArgumentParser(prog='adaptyst-analyser',
                                     description='Adaptyst Analyser web '
                                     'server')

    parser.add_argument('results', metavar='PATH', nargs='?',
                        help='relative or absolute path to a performance '
                        'analysis results '
                        'directory to inspect or an Adaptyst Analyser module '
                        'directory to install')
    parser.add_argument('--version', action='version', help='print '
                        'version and exit', version='v' + version(
                            'adaptyst-analyser'))
    parser.add_argument('-a',
                        metavar='ADDR',
                        dest='address',
                        help='address and port to bind to, '
                        'default: 127.0.0.1:8000',
                        default='127.0.0.1:8000')
    parser.add_argument('-t',
                        metavar='TITLE', dest='title', type=str, default='',
                        help='custom title to be displayed alongside '
                        '"Adaptyst Analyser" (e.g. if set to XYZ, the '
                        'displayed entire title will be '
                        '"Adaptyst Analyser (XYZ)")')
    parser.add_argument('-b',
                        metavar='CSS', dest='background', type=str,
                        default='', help='custom background CSS of the '
                        'website (syntax is the same as in "background" in '
                        'CSS, do not use semicolons)')
    parser.add_argument('-u', '--update', dest='update', action='store_true',
                        help='update/reinstall the module if it is already '
                        'installed')
    parser.add_argument('-e', '--editable', dest='editable',
                        action='store_true',
                        help='install the module in editable mode')
    parser.add_argument('-l', '--list', dest='list', action='store_true',
                        help='list all installed Adaptyst Analyser modules')

    args = parser.parse_args()

    if args.list:
        return 0

    if args.results is None:
        print('adaptyst-analyser: error: the following arguments '
              'are required: PATH', file=sys.stderr)
        return 1

    if ';' in args.background:
        print('adaptyst-analyser: error: semicolons are not allowed in -b',
              file=sys.stderr)
        return 1

    result_path = Path(args.results)

    if not result_path.exists():
        print(f'adaptyst-analyser: error: {args.results} does not exist',
              file=sys.stderr)
        return 1

    result_path = result_path.resolve()

    if not result_path.is_dir():
        print(f'adaptyst-analyser: error: {args.results} does not point '
              'to a directory', file=sys.stderr)
        return 1

    if (result_path / 'web').exists() and \
       (result_path / 'web').is_dir() and \
       (result_path / 'python').exists() and \
       (result_path / 'python').is_dir() and \
       (result_path / 'metadata.yml').exists() and \
       (result_path / 'metadata.yml').is_file():
        print('Adaptyst Analyser module directory detected, running in module '
              'install mode...', file=sys.stderr)

        module_path = result_path

        root_web_path = module_path / 'web'
        root_python_path = module_path / 'python'
        metadata_path = module_path / 'metadata.yml'

        if not root_web_path.exists():
            print(f'adaptyst-analyser: error: {str(root_web_path)} '
                  'does not exist', file=sys.stderr)
            return 2

        if not root_python_path.exists():
            print(f'adaptyst-analyser: error: {str(root_python_path)} '
                  'does not exist', file=sys.stderr)
            return 2

        if not metadata_path.exists():
            print(f'adaptyst-analyser: error: {str(metadata_path)} '
                  'does not exist', file=sys.stderr)
            return 2

        if not metadata_path.is_file():
            print(f'adaptyst-analyser: error: {str(metadata_path)} '
                  'does not point to a file', file=sys.stderr)
            return 2

        metadata_path_str = str(metadata_path)
        metadata_path = metadata_path.resolve()

        try:
            with metadata_path.open('r') as f:
                metadata = yaml.safe_load(f)
        except yaml.YAMLError as e:
            print(f'adaptyst-analyser: error: {metadata_path_str} '
                  f'is not a valid YAML file: {e}', file=sys.stderr)
            return 2

        if 'name' not in metadata:
            print(f'adaptyst-analyser: error: {metadata_path_str} '
                  'does not contain a "name" field', file=sys.stderr)
            return 2

        module_name = metadata['name']

        web_path = root_web_path / module_name
        python_path = root_python_path / module_name

        web_path_str = str(web_path)
        python_path_str = str(python_path)

        if not web_path.exists():
            print(f'adaptyst-analyser: error: {web_path_str} '
                  'does not exist', file=sys.stderr)
            return 2

        if not python_path.exists():
            print(f'adaptyst-analyser: error: {python_path_str} '
                  'does not exist', file=sys.stderr)
            return 2

        web_path = web_path.resolve()
        python_path = python_path.resolve()

        if not web_path.is_dir():
            print(f'adaptyst-analyser: error: {web_path_str} '
                  'does not point to a directory', file=sys.stderr)
            return 2

        if not python_path.is_dir():
            print(f'adaptyst-analyser: error: {python_path_str} '
                  'does not point to a directory', file=sys.stderr)
            return 2

        if not (python_path / '__init__.py').exists():
            print(f'adaptyst-analyser: error: {python_path_str} '
                  'does not contain an "__init__.py" file', file=sys.stderr)
            return 2

        if not (web_path / 'settings.html').exists():
            print(f'adaptyst-analyser: warning: {web_path_str} '
                  'does not contain a "settings.html" file, there will be '
                  'no settings available for this module on the client side',
                  file=sys.stderr)

        analyser_path = Path(import_module('adaptystanalyser').__file__).parent

        module_python_path = analyser_path / 'modules' / metadata['name']

        if module_python_path.exists():
            if args.update:
                shutil.rmtree(module_python_path)
            else:
                print(f'adaptyst-analyser: error: {metadata["name"]} '
                      'is already installed, use the --update flag',
                      file=sys.stderr)
                return 3

        module_python_path.mkdir(parents=True)

        module_web_path = analyser_path / 'static' / 'modules' / \
            metadata['name']
        global_deps_path = analyser_path / 'static' / 'deps'

        if module_web_path.exists():
            if args.update:
                shutil.rmtree(module_web_path)
            else:
                print(f'adaptyst-analyser: error: {metadata["name"]} '
                      'is already installed, use the --update flag',
                      file=sys.stderr)
                return 3

        module_web_path.mkdir(parents=True)

        def install(item, module_path):
            if item.is_dir():
                shutil.copytree(item, module_path / item.name,
                                dirs_exist_ok=True)
            else:
                shutil.copy(item, module_path / item.name)

        if 'python_dependencies' in metadata:
            pip_command = ['pip', 'install'] + \
                metadata['python_dependencies']

            try:
                subprocess.run(pip_command, check=True)
            except subprocess.CalledProcessError as e:
                print('adaptyst-analyser: error: could not install '
                      'module Python dependencies, pip exited with '
                      f'code {str(e.returncode)}', file=sys.stderr)
                return 2

        if 'js_dependencies' in metadata:
            deps_path = web_path / 'deps'

            for dep in metadata['js_dependencies']:
                item = deps_path / dep

                if not item.exists():
                    print('adaptyst-analyser: error: '
                          f'{dep} does not exist in deps',
                          file=sys.stderr)
                    return 2

                if item.is_symlink() and not item.resolve().is_file():
                    print('adaptyst-analyser: warning: '
                          f'skipping non-file {str(item)} in deps',
                          file=sys.stderr)
                    continue
                elif not item.is_file():
                    print('adaptyst-analyser: warning: '
                          f'skipping non-file {str(item)} in deps',
                          file=sys.stderr)
                    continue

                if item.suffix not in ['.js', '.css']:
                    print('adaptyst-analyser: warning: '
                          f'skipping file {str(item)} in deps as it is '
                          'neither .js nor .css',
                          file=sys.stderr)
                    continue

                if (global_deps_path / item.name).exists():
                    src_file = item

                    if src_file.is_symlink():
                        src_file = src_file.resolve()

                    dst_file = global_deps_path / item.name

                    if dst_file.is_symlink():
                        dst_file = dst_file.resolve()

                    if filecmp.cmp(src_file, dst_file,
                                   shallow=False):
                        continue
                    else:
                        pass

                if args.editable:
                    (global_deps_path / item.name).symlink_to(
                        item.resolve())
                else:
                    install(item, global_deps_path)

        if 'js_url_dependencies' in metadata:
            for url in metadata['js_url_dependencies']:
                with urllib.request.urlopen(url) as data:
                    with (global_deps_path /
                          Path(urlparse(url).path).name).open(mode='wb') as f:
                        shutil.copyfileobj(data, f)

        for item in web_path.iterdir():
            if item.name == 'deps':
                continue

            if args.editable:
                (module_web_path / item.name).symlink_to(item.resolve())
            else:
                install(item, module_web_path)

        for item in python_path.iterdir():
            if args.editable:
                (module_python_path / item.name).symlink_to(item.resolve())
            else:
                install(item, module_python_path)

        install(metadata_path, module_python_path)

        print(f'adaptyst-analyser: {metadata["name"]} '
              'installed successfully')
    else:
        print('Adaptyst Analyser module directory not detected, running in '
              'performance analysis result inspection mode...',
              file=sys.stderr)

        env = os.environ.copy()
        env.update({
            'FLASK_PERFORMANCE_ANALYSIS_STORAGE': str(result_path),
            'FLASK_OFFCPU_SAMPLING': str(args.off_cpu_sampling / 100),
            'FLASK_CUSTOM_TITLE': args.title,
            'FLASK_BACKGROUND_CSS': args.background
        })

        try:
            return subprocess.run(['gunicorn', '-b', args.address,
                                   'adaptystanalyser.app:app'],
                                  env=env).returncode
        except KeyboardInterrupt:
            return 130
