#### Ziel
Die Cover-Scan-Trefferliste soll beim Import dieselben Dialoge wie die externe Suche verwenden, inklusive korrekter Vorbefüllung von Autor- und Buchtitel-Daten.

#### Ausgangslage und Fundstellen
Ich habe die Cover-Scan-Controller-Logik und die bestehenden Import-Dialog-Controller überprüft, da dort die Trefferlisten-Buttons und die Prefill-Logik für Autor/Buch verarbeitet werden.

#### Durchgeführte Änderungen
Ich habe die Cover-Scan-Autor-Normalisierung und Titel-Decodierung ergänzt und die bestehenden Import-Dialoge so angepasst, dass Vor- und Nachnamen immer sauber vorbefüllt werden, auch wenn nur ein Teil vorhanden ist.

#### Tests und Nachweise
Es wurden keine automatischen Tests ausgeführt (keine projektspezifischen Testkommandos angegeben).

#### Refactoring-Bedarf (nicht umgesetzt)
Kein Refactoring-Bedarf festgestellt.

#### Offene Punkte und Blocker
Keine offenen Punkte oder Blocker.
