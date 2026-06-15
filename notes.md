####

- Site en une seule langue : en anglais
- Une page par ConceptScheme
	- .../vocabulary/af
	- lister tous les concepts de ce concept scheme
	- pour chaque concept, il faut afficher :
		- le skos:notation
		- les traductions fr / it / de
		- les synonymes fr / it / de
		- la skos:definition
		- les skos:exactMatch
	- générer le même arbre d3js que dans la page actuelle
- Il faut une Home Page
- Il faut un menu de sélection des vocabulaires



### Installation Eleventy 

## Create a package.jso

npm init -y

## install Eleventy

npm install @11ty/eleventy --save-dev


## Install libraries for convert a rdf file to json

npm install jsonld
npm install rdf-parse
npm install rdf-serialize
npm install @11ty/eleventy-fetch
npm install streamify-string
