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
    			{% set itemSlug = item.notation | slugify %}
    			<li>
    				<a href="vocabulary/{{ item.notation }}">{{ item.notation }} : {{ item.prefLabel | languageIn('en') }}</a>
    				<small class="numConcepts"> - {{ item.inverse_inScheme.length }} Concepts</small>
    				<span class="dropdown">
    					<a class="text-secondary" href="#" role="button" id="dl_{{ itemSlug }}" data-bs-toggle="dropdown" aria-expanded="false" title="Download">
    						<i class="fa-solid fa-download fa-xs"></i>
    					</a>
    					<ul class="dropdown-menu" aria-labelledby="dl_{{ itemSlug }}">
    						<li><a class="dropdown-item" href="{{ ('/downloads/' + itemSlug + '.ttl') | relative(page) }}" download>Turtle (.ttl)</a></li>
    						<li><a class="dropdown-item" href="{{ ('/downloads/' + itemSlug + '.jsonld') | relative(page) }}" download>JSON-LD (.jsonld)</a></li>
    					</ul>
    				</span>
    			</li>
    		{%- endfor-%}
    	</ul>
    </div>

</div>
