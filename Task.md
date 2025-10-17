## Task

Design an AI inference platform as a service, where users will be able to make inference
requests over Hyperswarm RPC. It should be a microservice-based architecture, which
communicates over Hyperswarm RPC. Attached to the task is a base worker class, which
should be inherited from for all microservice workers. Follow the same paradigm as the
base worker for the system.

**Requirements:**
- A system design document, outlining the structure of the system and user flow
diagrams
- Explain how services discover and communicate with each other
- Plan out data storage and replication
- Address scalability and robustness (eg. fault tolerance, data sharding, etc.)
- AI models will need to be run locally on the relevant service
- A skeleton implementation that demonstrates the above mechanics, and a detailed
README file documenting how to setup the boilerplate code

If you’re unable to complete the skeleton implementation, please add a document
mentioning how you would move forward if you had more time to complete the
assessment.

**Submission Steps**

Once completed, please upload the repo on GitHub and share access to the hiring
representative. Please share an email regarding the same with a link to the repo(s) you
have submitted.

### Best Practices

**Application:**
- Make sure to use standardjs formatting for all Javascript code (including
Markdown code blocks).
- Follow DRY principles (Don’t Repeat Yourself) wherever possible to keep code
structure modular and reusable.

**Evaluation Criteria**
- Quality of architectural design (clear components, data flow, use of P2P principles).
- Application code readability and structure.
- Documentation quality (clear to read and understand).