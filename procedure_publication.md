# Procedure de publication des vocabulaires SAPA

1. Récupérer les vocabulaires depuis la spreadsheet en ligne à https://docs.google.com/spreadsheets/d/1RFUTFI4LJIdQ-JXerhZfGSzezvOtkNaCUHDVLfeaSJw en allant dans l'onglet "Liens" et en récupérant l'export SKOS
2. Sauvegarder l'export SKOS dans `src/_data/vocabulary.ttl`
3. Lancer la commande `serve.sh` qui lance un serveur local, et vérifier à http://localhost:8080 que tout est bon
4. Lancer la commande `publish.sh` qui republie sur le serveur
5. Vérifier à http://vocab.performing-arts.ch/ que les modifs sont en ligne