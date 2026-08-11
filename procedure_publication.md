# Procedure de publication des vocabulaires SAPA

1. Convertir la spreadsheet en ligne à https://docs.google.com/spreadsheets/d/1RFUTFI4LJIdQ-JXerhZfGSzezvOtkNaCUHDVLfeaSJw en allant dans l'onglet "Liens" et en récupérant l'export SKOS
2. Charger les vocabulaires dans le DEV et dans la PROD :
	2.1 se logguer
	2.2 aller dans "roue crantée" > "Data import and download"
	2.3 rechercher le named graph "vocab" : http://vocab.performing-arts.ch/container/context
	2.4 supprimer ce named graph
	2.5 recharger l'export SKOS **EN SPECIFIANT BIEN LE TARGET NAMED GRAPH** : http://vocab.performing-arts.ch/container/context
4. Cleaner en local en faisant `npm run clean`
5. Lancer la commande `serve.sh` qui lance un serveur local, et vérifier à http://localhost:8080 que tout est bon (les données sont récupérées depuis le graphe http://vocab.performing-arts.ch/container/context de la PROD)
	- individual files are generated in `static/downloads`
	- main JSON-LD is generated in `src/_data/vocabulary.ttl`
6. Lancer la commande `publish.sh` qui republie sur le serveur
7. Vérifier à http://vocab.performing-arts.ch/ que les modifs sont en ligne