---
title: Swiss Performing Arts Vocabularies
layout: "main.njk"
---

<div class="row">
	<div class="col-md">
	    <h1 class="title-Header ">Welcome to Swiss Performing Arts vocabularies. </h1>
	    <p>Below you will find the complete list of vocabularies used in the platform <a href="https://www.performing-arts.ch/" target="_blank">performing-arts.ch</a></p>

		<ul>
			{%- for item in metadata.scheme.graph -%}
				<li><a href="vocabulary/{{ item.notation }}">{{ item.notation }} : {{ item.prefLabel | languageIn('en') }}</a> <small class="numConcepts"> - {{ item.inverse_inScheme.length }} Concepts</small></li>
			{%- endfor-%}
		</ul>
	</div>
</div>