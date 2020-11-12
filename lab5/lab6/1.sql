create table if not exists hero_name (
    id serial not null primary key,
    name text not null
);

insert into hero_name (name) values ('Джанктаун');
insert into hero_name (name) values ('Киллиан');
insert into hero_name (name) values ('Ян');
insert into hero_name (name) values ('Создател');
insert into hero_name (name) values ('Пэт');
insert into hero_name (name) values ('Пустынный Странник');
insert into hero_name (name) values ('Колдрис Хэмлок');
insert into hero_name (name) values ('Латам');

create table if not exists bad_word (
    id serial not null primary key,
    value text not null
);

insert into bad_word (value) values ('яд');
insert into bad_word (value) values ('отравление');
insert into bad_word (value) values ('убиты');
insert into bad_word (value) values ('обездоленные');
insert into bad_word (value) values ('вынудила');
insert into bad_word (value) values ('нарушил');
insert into bad_word (value) values ('уничтожения');
insert into bad_word (value) values ('уничтожить');
insert into bad_word (value) values ('секты');
insert into bad_word (value) values ('секта');
insert into bad_word (value) values ('завышать');
insert into bad_word (value) values ('глупее');
insert into bad_word (value) values ('невежественней');

create table if not exists ok_word (
    id serial not null primary key,
    value text not null
);

insert into ok_word (value) values ('выздоровел');
insert into ok_word (value) values ('молодец');
insert into ok_word (value) values ('сопротивление');
insert into ok_word (value) values ('воссоединились');
insert into ok_word (value) values ('ремонтирует');
insert into ok_word (value) values ('заправляет');
insert into ok_word (value) values ('воссоединяет');
insert into ok_word (value) values ('противоядие');
insert into ok_word (value) values ('противоядия');
insert into ok_word (value) values ('вылечить');
insert into ok_word (value) values ('разработать');

create table if not exists parsed_xml_data (
    id serial not null primary key,
    header text,
    txt text,
    revision_no integer,
    revision_ts timestamp,
    comment text,
    tags text,
    categories text,
    bad_words text,
    ok_words text,
    positivity_idx integer,
    heroes text,
    conclusion text
);

alter table if exists parsed_xml_data
    add column ok_words_count integer;

alter table if exists parsed_xml_data
    add column bad_words_count integer;


select * from get_not_names_cursor();

CREATE OR REPLACE FUNCTION get_not_names_cursor()
    returns TABLE(not_names text)
    language plpgsql
as
$$
DECLARE

  curs CURSOR FOR SELECT txt, revision_no FROM parsed_xml_data;

BEGIN

  FOR _text IN curs LOOP
    not_names := (
        SELECT string_agg(token, ',')
        FROM ts_debug('russian', _text.txt)
        WHERE token NOT IN (
            SELECT * from _get_names_by_revision_no(_text.revision_no)
        )
    );
	return next;
  END LOOP;

END;
$$;

create table if not exists villain (
    id serial not null primary key,
    value text not null
);

insert into villain (value) values ('Создатель');
insert into villain (value) values ('Отец');
insert into villain (value) values ('Фрэнк Хорриган');
insert into villain (value) values ('Келлог');
insert into villain (value) values ('Кага');

create table if not exists noun (
    id serial not null primary key,
    value text not null
);

insert into noun (value) values ('Гизмо');
insert into noun (value) values ('Сет');
insert into noun (value) values ('Николь');
insert into noun (value) values ('Морфеус');
insert into noun (value) values ('Гарри');

create table if not exists verb (
    id serial not null primary key,
    value text not null
);

insert into verb (value) values ('Отравил');
insert into verb (value) values ('Убил');
insert into verb (value) values ('Обманул');
insert into verb (value) values ('Захватил');
insert into verb (value) values ('Отпустил');

create table if not exists place (
    id serial not null primary key,
    value text not null
);

insert into place (value) values ('ГЕЛИОС Один');
insert into place (value) values ('Гудспрингс');
insert into place (value) values ('Пустошь Мохаве');
insert into place (value) values ('Логово старателей');
insert into place (value) values ('Джейкобстаун');

create table if not exists org (
    id serial not null primary key,
    value text not null
);

insert into org (value) values ('Братство Стали');
insert into org (value) values ('Подрывники');
insert into org (value) values ('Легион Цезаря');
insert into org (value) values ('Мистер Хаус');
insert into org (value) values ('Красный караван');


CREATE OR REPLACE FUNCTION get_actions()
    returns TABLE(action text)
    language plpgsql
as
$$
DECLARE
BEGIN
    return query select concat(concat('[сущ]', noun.value, '[\сущ]'), ' ', concat('[глаг]', verb.value, '[\глаг]'), ' ', concat('[злод]', villain.value, '[\злод]')) as action
from noun
    cross join verb
    cross join villain;
END;
$$;

select action from get_actions();



select * from get_names_cursor();

CREATE OR REPLACE FUNCTION get_names_cursor()
    returns TABLE(names text)
    language plpgsql
as
$$
DECLARE

  curs CURSOR FOR SELECT txt, revision_no FROM parsed_xml_data;

BEGIN

  FOR _text IN curs LOOP
      names := (
        select string_agg(_get_names_by_revision_no.names, ',')
        from _get_names_by_revision_no(_text.revision_no)
      );
	return next;
  END LOOP;

END;
$$;


CREATE OR REPLACE FUNCTION _get_names_by_revision_no(rev_no integer)
    returns TABLE(names text)
    language plpgsql
as
$$
DECLARE
BEGIN

    return query SELECT token as names
        FROM ts_debug('russian', (SELECT txt FROM parsed_xml_data WHERE revision_no = rev_no))
        WHERE SUBSTRING(token FROM 1 FOR 1) != LOWER(SUBSTRING(token FROM 1 FOR 1));

END;
$$;

copy (select row_number() OVER () as rnum, header, ok_words_count, bad_words_count
from parsed_xml_data) to '/Users/ilyap/my_git/ituz/lab5/output.csv' csv;

COPY (select row_number() OVER () as rnum, header, ok_words_count, bad_words_count
from parsed_xml_data) TO '/var/lib/postgresql/data/out.csv' WITH (FORMAT CSV, HEADER);

