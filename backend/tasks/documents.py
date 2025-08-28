# from django_elasticsearch_dsl import Document,fields
# from django_elasticsearch_dsl.registries import registry
# from .models import Task

# @registry.register_document
# class TaskDocument(Document):
#     title=fields.TextField(
#         attr='title',
#         fields={
#             'raw':fields.KeywordField(),
#             'suggest':fields.CompletionField(),
#         }
#     )
#     description=fields.TextField(
#         attr='description',
#         fields={
#             'raw':fields.KeywordField(),
#         }
#     )

#     category=fields.KeywordField(attr='category')
#     completed=fields.BooleanField(attr='completed')
#     due_date=fields.DateField(attr='due_date')
#     user=fields.IntegerField(attr='user_id')
#     parent_task=fields.IntegerField(attr='parent_task_id',null=True)
#     full_path_titles=fields.KeywordField()

#     class Index:
#         name='tasks'
#         settings={'number_of_shards':1,'number_of_replicas':0}
    
#     class Django:
#         model=Task
#         fields=['id','created_at']

#         def get_queryset(self):
#             return self.get_model().objects.all().select_related('user','parent_task')
        
#         def prepare_full_path_titles(self,instance):
#             path=[]
#             cur=instance
#             while cur:
#                 path.insert(0,cur.title)
#                 cur=cur.parent_task
#             return path