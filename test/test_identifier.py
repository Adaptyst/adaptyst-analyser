import pytest
from adaptiveperf import Identifier


def test_incorrect_id_str1():
    with pytest.raises(ValueError):
        Identifier('blablabla')


def test_incorrect_id_str2():
    with pytest.raises(ValueError):
        Identifier('2023_10_11_15_18_33_blabla_blabla_test')


def test_incorrect_id_str3():
    with pytest.raises(ValueError):
        Identifier('2023_10_11_15_18_blabla_blabla_test')


def test_id_str_no_seconds():
    identifier = Identifier('2023_10_11_15_18_blabla_blabla test')

    assert str(identifier) == '[blabla_blabla] test (2023-10-11 15:18)'
    assert identifier.year == 2023
    assert identifier.month == 10
    assert identifier.day == 11
    assert identifier.hour == 15
    assert identifier.minute == 18
    assert identifier.second is None
    assert identifier.executor == 'blabla_blabla'
    assert identifier.name == 'test'
    assert identifier.value == '2023_10_11_15_18_blabla_blabla test'


def test_id_str_with_seconds():
    identifier = Identifier('2023_10_11_15_18_33_blabla_blabla test')

    assert str(identifier) == '[blabla_blabla] test (2023-10-11 15:18:33)'
    assert identifier.year == 2023
    assert identifier.month == 10
    assert identifier.day == 11
    assert identifier.hour == 15
    assert identifier.minute == 18
    assert identifier.second == 33
    assert identifier.executor == 'blabla_blabla'
    assert identifier.name == 'test'
    assert identifier.value == '2023_10_11_15_18_33_blabla_blabla test'
