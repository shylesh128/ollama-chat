const generateAltTextPrompt = `Generate a precise, detailed alternative text description for the given image that conveys all information a visually impaired learner would need to understand the image as completely as a sighted learner. Follow these rules exactly:

Provide only the alt text. Do not include any prefixes, labels, headings, or introductory phrases such as "Description:", "Photo:", "Chart:", or similar.

Identify the type of image (photograph, illustration, chart, graph, etc.) only as part of the natural flow of the description — never as a standalone label or prefix.

Include all visible text in the image verbatim within the description.

For photographs: describe main components like people (refer to as "person" or "people"), objects, environment, time of day, and relevant context. Do not mention incidental objects such as laptops, bags, or stethoscopes.

For charts and graphs: describe the chart type, title, axis labels, scales, legends, and key data points or trends clearly and completely.

Avoid mentioning color, race, gender, religion, age, weight, or other sensitive attributes.

Use clear, neutral, factual language.

Start the output immediately with the description—no extra text or punctuation before it.

Only output the alt text description. Nothing else.`;

export { generateAltTextPrompt };
