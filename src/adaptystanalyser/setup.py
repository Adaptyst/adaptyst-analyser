# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import sys
import argparse
import yaml
import shutil
import filecmp
from pathlib import Path
from importlib import import_module
from importlib.metadata import version


def main():
    parser = argparse.ArgumentParser(prog='adaptyst-setup-armodule',
                                     description='Setup utility for Adaptyst '
                                     'Analyser modules')

    parser.add_argument('module', metavar='PATH',
                        help='path to an Adaptyst Analyser module directory '
                        'to install (usually ends with the "analyser" folder)')
    parser.add_argument('--version', action='version', help='print '
                        'version and exit', version='v' + version(
                            'adaptyst-analyser'))
    parser.add_argument('-u,--update', action='store_true',
                        help='update/reinstall the module if it is already '
                        'installed')
    parser.add_argument('-e,--editable', action='store_true',
                        help='install the module in editable mode')

    args = parser.parse_args()

    module_path = Path(args.module)

    if not module_path.exists():
        print(f'adaptyst-setup-armodule: error: {args.module} '
              'does not exist', file=sys.stderr)
        return 1

    module_path = module_path.resolve()

    if not module_path.is_dir():
        print(f'adaptyst-setup-armodule: error: {args.module} '
              'does not point to a directory', file=sys.stderr)
        return 1

    root_web_path = module_path / 'web'
    root_python_path = module_path / 'python'
    metadata_path = module_path / 'metadata.yml'

    if not root_web_path.exists():
        print(f'adaptyst-setup-armodule: error: {str(root_web_path)} '
              'does not exist', file=sys.stderr)
        return 2

    if not root_python_path.exists():
        print(f'adaptyst-setup-armodule: error: {str(root_python_path)} '
              'does not exist', file=sys.stderr)
        return 2

    if not metadata_path.exists():
        print(f'adaptyst-setup-armodule: error: {str(metadata_path)} '
              'does not exist', file=sys.stderr)
        return 2

    if not metadata_path.is_file():
        print(f'adaptyst-setup-armodule: error: {str(metadata_path)} '
              'does not point to a file', file=sys.stderr)
        return 2

    metadata_path_str = str(metadata_path)
    metadata_path = metadata_path.resolve()

    try:
        with metadata_path.open('r') as f:
            metadata = yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(f'adaptyst-setup-armodule: error: {metadata_path_str} '
              f'is not a valid YAML file: {e}', file=sys.stderr)
        return 2

    if 'name' not in metadata:
        print(f'adaptyst-setup-armodule: error: {metadata_path_str} '
              'does not contain a "name" field', file=sys.stderr)
        return 2

    module_name = metadata['name']

    web_path = root_web_path / module_name
    python_path = root_python_path / module_name

    web_path_str = str(web_path)
    python_path_str = str(python_path)

    if not web_path.exists():
        print(f'adaptyst-setup-armodule: error: {web_path_str} '
              'does not exist', file=sys.stderr)
        return 2

    if not python_path.exists():
        print(f'adaptyst-setup-armodule: error: {python_path_str} '
              'does not exist', file=sys.stderr)
        return 2

    web_path = web_path.resolve()
    python_path = python_path.resolve()

    if not web_path.is_dir():
        print(f'adaptyst-setup-armodule: error: {web_path_str} '
              'does not point to a directory', file=sys.stderr)
        return 2

    if not python_path.is_dir():
        print(f'adaptyst-setup-armodule: error: {python_path_str} '
              'does not point to a directory', file=sys.stderr)
        return 2

    if not (python_path / '__init__.py').exists():
        print(f'adaptyst-setup-armodule: error: {python_path_str} '
              'does not contain an "__init__.py" file', file=sys.stderr)
        return 2

    if not (web_path / 'settings.html').exists():
        print(f'adaptyst-setup-armodule: warning: {web_path_str} '
              'does not contain a "settings.html" file, there will be '
              'no settings available for this module on the client side',
              file=sys.stderr)

    analyser_path = Path(import_module('adaptystanalyser').__file__).parent

    module_python_path = analyser_path / 'modules' / metadata['name']

    if module_python_path.exists():
        if args.update:
            shutil.rmtree(module_python_path)
        else:
            print(f'adaptyst-setup-armodule: error: {metadata["name"]} '
                  'is already installed, use the --update flag',
                  file=sys.stderr)
            return 3

    module_python_path.mkdir(parents=True)

    module_web_path = analyser_path / 'static' / 'modules' / metadata['name']
    global_deps_path = analyser_path / 'static' / 'deps'

    if module_web_path.exists():
        if args.update:
            shutil.rmtree(module_web_path)
        else:
            print(f'adaptyst-setup-armodule: error: {metadata["name"]} '
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

    if (web_path / 'deps').exists() and (web_path / 'deps').is_dir():
        deps_path = web_path / 'deps'

        for item in deps_path.iterdir():
            if not item.is_file():
                print('adaptyst-setup-armodule: warning: '
                      f'skipping non-file {str(item)} in deps',
                      file=sys.stderr)
                continue

            if item.suffix not in ['.js', '.css']:
                print('adaptyst-setup-armodule: warning: '
                      f'skipping file {str(item)} in deps as it is neither '
                      '.js nor .css',
                      file=sys.stderr)
                continue

            if (global_deps_path / item.name).exists():
                if filecmp.cmp(item, global_deps_path / item.name,
                               shallow=False):
                    continue
                else:
                    pass

            if args.editable:
                (global_deps_path / item.name).symlink_to(
                    item.resolve())
            elif item.is_symlink():
                install(item.resolve(), global_deps_path)
            else:
                install(item, global_deps_path)

    for item in web_path.iterdir():
        if item.name == 'deps':
            continue

        if args.editable:
            (module_web_path / item.name).symlink_to(item.resolve())
        elif item.is_symlink():
            install(item.resolve(), module_web_path)
        else:
            install(item, module_web_path)

    for item in python_path.iterdir():
        if args.editable:
            (module_python_path / item.name).symlink_to(item.resolve())
        elif item.is_symlink():
            install(item.resolve(), module_python_path)
        else:
            install(item, module_python_path)

    print(f'adaptyst-setup-armodule: {metadata["name"]} '
          'installed successfully')
