# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import json
import yaml
import random
from pathlib import Path


class Identifier:
    """
    A class representing a performance analysis session identifier.
    """

    def __init__(self, result: Path):
        """
        Construct an Identifier object, checking the correctness
        of the supplied result folder.

        :param pathlib.Path result: A performance analysis session folder.
        :raises ValueError: When a provided folder doesn't exist or is incorrect.
        """
        if not (result / 'dirmeta.json').exists():
            raise ValueError(str(result / 'dirmeta.json') + ' does not exist!')

        with (result / 'dirmeta.json').open(mode='r') as f:
            metadata = json.load(f)

        if 'year' not in metadata or \
           'month' not in metadata or \
           'day' not in metadata or \
           'hour' not in metadata or \
           'minute' not in metadata or \
           'second' not in metadata or \
           'label' not in metadata:
            raise ValueError('The metadata do not have all the required fields!')

        self._year, self._month, self._day, self._hour, self._minute, \
            self._second, self._label = metadata['year'], \
            metadata['month'], \
            metadata['day'], metadata['hour'], metadata['minute'], \
            metadata['second'], metadata['label']

        if self._month < 10:
            self._month = '0' + str(self._month)
        else:
            self._month = str(self._month)

        if self._day < 10:
            self._day = '0' + str(self._day)
        else:
            self._day = str(self._day)

        if self._hour < 10:
            self._hour = '0' + str(self._hour)
        else:
            self._hour = str(self._hour)

        if self._minute < 10:
            self._minute = '0' + str(self._minute)
        else:
            self._minute = str(self._minute)

        if self._second < 10:
            self._second = '0' + str(self._second)
        else:
            self._second = str(self._second)

        self._id_str = result.name

    def __str__(self):
        """
        Return a user-friendly string representation of the identifier in
        form of "<label> ( <year>-<month>-<day> <hour>:<minute>:<second>)".
        """
        return f'{self._label} (' \
            f'{self._year}-{self._month}-{self._day} ' \
            f'{self._hour}:{self._minute}:{self._second})'

    @property
    def label(self):
        return self._label

    @property
    def year(self):
        return int(self._year)

    @property
    def month(self):
        return int(self._month)

    @property
    def day(self):
        return int(self._day)

    @property
    def hour(self):
        return int(self._hour)

    @property
    def minute(self):
        return int(self._minute)

    @property
    def second(self):
        if self._second is not None:
            return int(self._second)

        return None

    @property
    def value(self):
        return self._id_str

    def __eq__(self, other):
        return self.value == other.value

    def __hash__(self):
        return hash(self.value)


class PerformanceAnalysisResults:
    """
    A class describing the results of a specific performance analysis
    session stored inside a given results directory.
    """

    def get_all_folders(path_str: str) -> list:
        """
        Get the folders of all performance analysis sessions stored in
        a given results directory.

        :param str path_str: The path string to a performance analysis
                             results directory.
        :return: The list of folders that can be used
                 for constructing a PerformanceAnalysisResults object.
        """
        ids = []
        path = Path(path_str)

        for x in filter(Path.is_dir, path.glob('*')):
            try:
                identifier = Identifier(x)
            except ValueError:
                continue

            ids.append(identifier)

        return list(sorted(ids, key=lambda x: (-x.year,
                                               -x.month,
                                               -x.day,
                                               -x.hour,
                                               -x.minute,
                                               -x.second,
                                               x.label)))

    def __init__(self, performance_analysis_storage: str, folder: str):
        """
        Construct a PerformanceAnalysisResults object.

        :param str performance_analysis_storage: The path string to a
                                                 performance analysis
                                                 results directory.
        :param str folder: The folder of a performance analysis session
                           stored inside the results directory.
                           Call get_all_folders() for the list of all
                           valid folders.
        """
        self._path = Path(performance_analysis_storage) / folder
        self._identifier = Identifier(self._path)

        with (self._path / 'system' / 'system.yml').open(mode='r') as f:
            self._system = yaml.safe_load(f)

        self._node_backends = {}

        for entity in self._system['entities'].values():
            for node, settings in entity['nodes'].items():
                self._node_backends[node] = settings['backend']

    def get_backend_name(self, node):
        return self._node_backends[node]

    def get_system_graph(self):
        used_colours = set()
        entities = {}

        for entity in self._system['entities'].keys():
            colour = (random.randrange(100, 181, 10),
                      random.randrange(100, 181, 10),
                      random.randrange(100, 181, 10))

            while colour in used_colours:
                colour = (random.randrange(100, 181, 10),
                          random.randrange(100, 181, 10),
                          random.randrange(100, 181, 10))

            used_colours.add(colour)
            entities[entity] = f'#{colour[0]:02x}{colour[1]:02x}{colour[2]:02x}'

        return json.dumps({
            'entities': entities,
            'system': {
                'options': {
                    'allowSelfLoops': False,
                    'multi': False,
                    'type': 'mixed'
                },
                'nodes': [
                    {
                        'key': k,
                        'attributes': {
                            'x': 0,
                            'y': 0,
                            'label': k,
                            'size': 50,
                            'color': entities[entity],
                            'entity': entity,
                            'backend': v['backend']
                        }
                    }
                    for entity in self._system['entities'].keys()
                    for k, v in self._system['entities'][entity]['nodes'].items()
                ]
            }
        })
