# Procedure de publication des vocabulaires SAPA

1. Convertir la spreadsheet en ligne à https://docs.google.com/spreadsheets/d/1RFUTFI4LJIdQ-JXerhZfGSzezvOtkNaCUHDVLfeaSJw en allant dans l'onglet "Liens" et en récupérant l'export SKOS
2. Charger les vocabulaires dans le DEV et dans la PROD
3. Lancer la commande `serve.sh` qui lance un serveur local, et vérifier à http://localhost:8080 que tout est bon (les données sont récupérées depuis le graphe http://vocab.performing-arts.ch/container/context de la PROD)
	- individual files are generated in `static/downloads`
	- main JSON-LD is generated in `src/_data/vocabulary.ttl`
4. Lancer la commande `publish.sh` qui republie sur le serveur
5. Vérifier à http://vocab.performing-arts.ch/ que les modifs sont en ligne